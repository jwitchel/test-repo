import { LLMClient } from '../llm-client';
import { ProcessedEmail } from './types';
import { pool as db } from '../../server';
import { imapLogger } from '../imap-logger';
import { TemplateManager } from './template-manager';
import { decryptPassword } from '../crypto';
import { nameRedactor } from '../name-redactor';

// Pattern data structures that match what we'll store in JSONB
export interface SentencePatterns {
  avgLength: number;
  minLength: number;
  maxLength: number;
  stdDeviation: number;
  distribution: {
    short: number;    // <10 words
    medium: number;   // 10-25 words
    long: number;     // >25 words
  };
  examples: string[];
}

export interface ParagraphPattern {
  type: string;
  percentage: number;
  description: string;
}

export interface OpeningPattern {
  pattern: string;
  frequency: number;
  notes?: string;
}

export interface ValedictionPattern {
  phrase: string;
  percentage: number;
}

export interface TypedNamePattern {
  phrase: string;
  percentage: number;
}

export interface NegativePattern {
  description: string;
  confidence: number;
  examples?: string[];
  context?: string;
}

export interface ResponsePatterns {
  immediate: number;
  contemplative: number;
  questionHandling: string;
}

export interface UniqueExpression {
  phrase: string;
  context: string;
  frequency: number;
}

export interface WritingPatterns {
  sentencePatterns: SentencePatterns;
  paragraphPatterns: ParagraphPattern[];
  openingPatterns: OpeningPattern[];
  valediction: ValedictionPattern[];
  typedName: TypedNamePattern[];
  negativePatterns: NegativePattern[];
  responsePatterns: ResponsePatterns;
  uniqueExpressions: UniqueExpression[];
}

export interface BatchAnalysisResult extends WritingPatterns {
  emailCount: number;
  dateRange: {
    start: Date;
    end: Date;
  };
}

export class WritingPatternAnalyzer {
  private llmClient: LLMClient | null = null;
  private templateManager: TemplateManager;
  private modelName: string = '';

  constructor() {
    this.templateManager = new TemplateManager();
  }

  /**
   * Recursively round all numeric values in an object to specified decimal places
   */
  private roundNumericValues(obj: any, decimals: number = 2): any {
    if (typeof obj === 'number') {
      return Math.round(obj * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.roundNumericValues(item, decimals));
    }
    
    if (obj !== null && typeof obj === 'object') {
      const rounded: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          rounded[key] = this.roundNumericValues(obj[key], decimals);
        }
      }
      return rounded;
    }
    
    return obj;
  }

  /**
   * Get the model name being used
   */
  getModelName(): string {
    return this.modelName;
  }

  /**
   * Initialize with LLM configuration
   */
  async initialize(llmProviderId?: string): Promise<void> {
    // Initialize template manager
    await this.templateManager.initialize();
    // Get LLM provider configuration using raw SQL
    let query = `
      SELECT id, provider_name, provider_type, api_key_encrypted as api_key, api_endpoint, 
             model_name, is_active, is_default, created_at
      FROM llm_providers 
      WHERE is_active = true
    `;
    const params: any[] = [];
    
    if (llmProviderId) {
      query += ' AND id = $1';
      params.push(llmProviderId);
    } else {
      // First try to get default, then fall back to any active provider
      query += ' ORDER BY is_default DESC, created_at DESC';
    }
    
    query += ' LIMIT 1';
    
    const result = await db.query(query, params);
    const provider = result.rows[0];

    if (!provider) {
      throw new Error('No active LLM provider found');
    }

    console.log('Retrieved provider from database:', {
      id: provider.id,
      name: provider.provider_name,
      type: provider.provider_type,
      hasApiKey: !!provider.api_key,
      apiKeyLength: provider.api_key ? provider.api_key.length : 0,
      isActive: provider.is_active,
      isDefault: provider.is_default
    });

    // Check if API key exists
    if (!provider.api_key) {
      console.error('LLM provider has no API key:', provider.provider_name);
      throw new Error(`LLM provider "${provider.provider_name}" has no API key configured`);
    }

    // Decrypt the API key
    let decryptedApiKey = '';
    try {
      decryptedApiKey = decryptPassword(provider.api_key);
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      throw new Error('Failed to decrypt LLM provider API key');
    }

    console.log('WritingPatternAnalyzer: Using LLM provider:', {
      id: provider.id,
      name: provider.provider_name,
      type: provider.provider_type,
      model: provider.model_name,
      hasApiKey: !!decryptedApiKey
    });

    this.modelName = provider.model_name || '';
    this.llmClient = new LLMClient({
      id: provider.id,
      type: provider.provider_type as any,
      apiKey: decryptedApiKey,
      apiEndpoint: provider.api_endpoint || undefined,
      modelName: provider.model_name
    });
  }

  /**
   * Main entry point - analyze writing patterns from email corpus
   */
  async analyzeWritingPatterns(
    userId: string,
    emails: ProcessedEmail[],
    relationship?: string
  ): Promise<WritingPatterns> {
    if (!this.llmClient) {
      throw new Error('WritingPatternAnalyzer not initialized');
    }

    const startTime = Date.now();

    // Log the analysis start
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'pattern-analysis',
      level: 'info',
      command: 'pattern.analysis.start',
      data: {
        raw: `Analyzing ${emails.length} emails for ${relationship || 'all relationships'}`
      }
    });

    // Process in batches of 50 emails
    const batchSize = 50;
    const batches = this.chunkEmails(emails, batchSize);
    
    console.log(`Analyzing ${emails.length} emails in ${batches.length} batches...`);

    const batchAnalyses: BatchAnalysisResult[] = [];
    let successfulBatches = 0;
    let failedBatches = 0;
    
    for (let i = 0; i < batches.length; i++) {
      console.log(`Processing batch ${i + 1}/${batches.length}...`);
      
      try {
        const analysis = await this.analyzeBatch(batches[i], relationship);
        batchAnalyses.push(analysis);
        successfulBatches++;
      } catch (error) {
        console.error(`Error analyzing batch ${i + 1}:`, error);
        failedBatches++;
        // Continue with other batches even if one fails
      }
    }

    if (batchAnalyses.length === 0) {
      throw new Error('Failed to analyze any email batches');
    }

    // Aggregate patterns across all batches
    const aggregated = this.aggregatePatterns(batchAnalyses);

    // Round all numeric values to 2 decimal places
    const roundedPatterns = this.roundNumericValues(aggregated) as WritingPatterns;

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    // Log completion with metadata
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'pattern-analysis',
      level: 'info',
      command: 'pattern.analysis.complete',
      data: {
        raw: `Found ${roundedPatterns.openingPatterns.length} opening patterns, ${roundedPatterns.valediction.length} valedictions, ${roundedPatterns.typedName.length} typed names, ${roundedPatterns.negativePatterns.length} negative patterns, ${roundedPatterns.uniqueExpressions.length} unique expressions`,
        parsed: {
          totalEmails: emails.length,
          batchSize,
          totalBatches: batches.length,
          successfulBatches,
          failedBatches,
          durationSeconds: duration,
          relationship: relationship || 'aggregate',
          patterns: {
            openings: roundedPatterns.openingPatterns.length,
            valedictions: roundedPatterns.valediction.length,
            typedNames: roundedPatterns.typedName.length,
            negative: roundedPatterns.negativePatterns.length,
            unique: roundedPatterns.uniqueExpressions.length
          }
        }
      }
    });

    return roundedPatterns;
  }

  /**
   * Analyze a single batch of emails
   */
  private async analyzeBatch(
    emails: ProcessedEmail[],
    relationship?: string
  ): Promise<BatchAnalysisResult> {
    if (!this.llmClient) {
      throw new Error('LLM client not initialized');
    }

    // Prepare email content for analysis with name redaction
    let totalNamesRedacted = 0;
    const emailTexts = emails.map(email => {
      // Redact names from the email content
      const redactionResult = nameRedactor.redactNames(email.extractedText);
      totalNamesRedacted += redactionResult.namesFound.length;
      
      return {
        date: email.date.toISOString(),
        to: email.to.map(t => t.address).join(', '),
        subject: email.subject,
        content: redactionResult.text,
        // Store original names for reference (not sent to LLM)
        _originalNames: redactionResult.namesFound
      };
    });
    
    // Log redaction statistics
    if (totalNamesRedacted > 0) {
      console.log(`[Pattern Analysis] Redacted ${totalNamesRedacted} names from ${emails.length} emails`);
    }

    // Prepare template data
    const templateData = {
      emailCount: emails.length,
      relationship: relationship,
      emails: emailTexts
    };

    // Generate prompts using templates
    const [systemPrompt, userPrompt] = await Promise.all([
      this.templateManager.renderSystemPrompt('pattern-analysis'),
      this.templateManager.renderPrompt('pattern-analysis', templateData as any)
    ]);
    
    // Call LLM with structured output expectation
    // Adjust max tokens based on model limits
    const requestedMaxTokens = parseInt(process.env.PATTERN_ANALYSIS_MAX_TOKENS || '20000');
    const modelNameLower = this.modelName.toLowerCase();
    
    // Known model limits for completion tokens
    let maxTokens = requestedMaxTokens;
    if (modelNameLower.includes('gpt-4-turbo-preview') || modelNameLower.includes('gpt-4-0125-preview')) {
      maxTokens = Math.min(requestedMaxTokens, 4096);
    } else if (modelNameLower.includes('gpt-3.5')) {
      maxTokens = Math.min(requestedMaxTokens, 4096);
    } else if (modelNameLower.includes('claude-3')) {
      maxTokens = Math.min(requestedMaxTokens, 4096);
    } else if (modelNameLower.includes('gpt-4o')) {
      maxTokens = Math.min(requestedMaxTokens, 16384);
    }
    // For other models, use the requested amount
    
    console.log(`Pattern analysis using ${maxTokens} max tokens for model: ${this.modelName}`);
    
    const response = await this.llmClient.generate(userPrompt, {
      temperature: 0.3, // Lower temperature for more consistent analysis
      maxTokens,
      systemPrompt
    });

    // Parse the response
    try {
      // Extract JSON from response, handling various formats
      let cleanResponse = response.trim();
      
      // Try to find JSON content within the response
      // First, check if entire response is wrapped in markdown
      const markdownJsonMatch = cleanResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (markdownJsonMatch) {
        cleanResponse = markdownJsonMatch[1].trim();
      }
      
      // If still not valid JSON, try to extract JSON object
      if (!cleanResponse.startsWith('{')) {
        const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanResponse = jsonMatch[0];
        }
      }
      
      const parsed = JSON.parse(cleanResponse);
      
      // Add metadata
      return {
        ...parsed,
        emailCount: emails.length,
        dateRange: {
          start: emails[0].date,
          end: emails[emails.length - 1].date
        }
      };
    } catch (error) {
      console.error('Failed to parse LLM response:', response);
      throw new Error('Invalid response format from LLM');
    }
  }

  // Remove buildAnalysisPrompt method - no longer needed since we use templates

  /**
   * Chunk emails into batches
   */
  private chunkEmails(emails: ProcessedEmail[], batchSize: number): ProcessedEmail[][] {
    const chunks: ProcessedEmail[][] = [];
    for (let i = 0; i < emails.length; i += batchSize) {
      chunks.push(emails.slice(i, i + batchSize));
    }
    return chunks;
  }

  /**
   * Aggregate patterns from multiple batches
   * - Weights patterns by email count only
   * - Handles relationship-specific variations
   * - Identifies context-dependent patterns
   */
  private aggregatePatterns(batchResults: BatchAnalysisResult[]): WritingPatterns {
    if (batchResults.length === 1) {
      // If only one batch, return it directly
      const { emailCount, dateRange, ...patterns } = batchResults[0];
      return patterns;
    }

    // Calculate weights based on email count only
    const batchWeights = batchResults.map(batch => {
      return {
        batch,
        weight: batch.emailCount
      };
    });
    
    // Aggregate sentence patterns with email count weighting
    const sentencePatterns: SentencePatterns = {
      avgLength: this.weightedAverage(
        batchWeights.map(({ batch, weight }) => ({ 
          value: batch.sentencePatterns.avgLength, 
          weight 
        }))
      ),
      minLength: Math.min(...batchResults.map(b => b.sentencePatterns.minLength)),
      maxLength: Math.max(...batchResults.map(b => b.sentencePatterns.maxLength)),
      stdDeviation: this.weightedAverage(
        batchWeights.map(({ batch, weight }) => ({ 
          value: batch.sentencePatterns.stdDeviation, 
          weight 
        }))
      ),
      distribution: {
        short: this.weightedAverage(
          batchWeights.map(({ batch, weight }) => ({ 
            value: batch.sentencePatterns.distribution.short, 
            weight 
          }))
        ),
        medium: this.weightedAverage(
          batchWeights.map(({ batch, weight }) => ({ 
            value: batch.sentencePatterns.distribution.medium, 
            weight 
          }))
        ),
        long: this.weightedAverage(
          batchWeights.map(({ batch, weight }) => ({ 
            value: batch.sentencePatterns.distribution.long, 
            weight 
          }))
        )
      },
      examples: this.mergeExamples(batchWeights)
    };

    // Aggregate paragraph patterns with email count weighting
    const paragraphPatterns = this.mergePatternsByType(
      batchWeights.map(({ batch, weight }) => ({ 
        patterns: batch.paragraphPatterns, 
        weight 
      }))
    );

    // Aggregate opening patterns with context awareness
    const openingPatterns = this.mergePatternsByFrequency(
      batchWeights.map(({ batch, weight }) => ({ 
        patterns: batch.openingPatterns, 
        weight 
      }))
    );

    // Aggregate negative patterns (union of all, keep highest confidence)
    const negativePatterns = this.mergeNegativePatterns(
      batchResults.map(b => b.negativePatterns)
    );

    // Aggregate response patterns with email count weighting
    const responsePatterns: ResponsePatterns = {
      immediate: this.weightedAverage(
        batchWeights.map(({ batch, weight }) => ({ 
          value: batch.responsePatterns.immediate, 
          weight 
        }))
      ),
      contemplative: this.weightedAverage(
        batchWeights.map(({ batch, weight }) => ({ 
          value: batch.responsePatterns.contemplative, 
          weight 
        }))
      ),
      questionHandling: this.mostCommonStringWeighted(
        batchWeights.map(({ batch, weight }) => ({ 
          value: batch.responsePatterns.questionHandling, 
          weight 
        }))
      )
    };

    // Aggregate unique expressions with context awareness
    const uniqueExpressions = this.mergeUniqueExpressions(
      batchWeights.map(({ batch, weight }) => ({ 
        expressions: batch.uniqueExpressions, 
        weight 
      }))
    );

    // Aggregate valediction patterns
    const valediction = this.mergePercentagePatterns(
      batchWeights.map(({ batch, weight }) => ({ 
        patterns: batch.valediction || [], 
        weight 
      }))
    );

    // Aggregate typed name patterns
    const typedName = this.mergePercentagePatterns(
      batchWeights.map(({ batch, weight }) => ({ 
        patterns: batch.typedName || [], 
        weight 
      }))
    );

    return {
      sentencePatterns,
      paragraphPatterns,
      openingPatterns,
      valediction,
      typedName,
      negativePatterns,
      responsePatterns,
      uniqueExpressions
    };
  }

  // Helper methods for aggregation
  private weightedAverage(items: { value: number; weight: number }[]): number {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    const weightedSum = items.reduce((sum, item) => sum + item.value * item.weight, 0);
    return weightedSum / totalWeight;
  }


  private mergeExamples(
    batchWeights: { batch: BatchAnalysisResult; weight: number }[]
  ): string[] {
    // Collect examples with their weights
    const examplesWithWeights: { example: string; weight: number }[] = [];
    
    batchWeights.forEach(({ batch, weight }) => {
      batch.sentencePatterns.examples.forEach(example => {
        examplesWithWeights.push({ example, weight });
      });
    });
    
    // Sort by weight (prioritize examples from larger batches) and deduplicate
    const uniqueExamples = new Map<string, number>();
    examplesWithWeights
      .sort((a, b) => b.weight - a.weight)
      .forEach(({ example, weight }) => {
        if (!uniqueExamples.has(example)) {
          uniqueExamples.set(example, weight);
        }
      });
    
    // Return top N examples
    const exampleCount = parseInt(process.env.PATTERN_EXAMPLE_COUNT || '10');
    return Array.from(uniqueExamples.keys()).slice(0, exampleCount);
  }

  private mergePatternsByType(
    batchData: { patterns: ParagraphPattern[]; weight: number }[]
  ): ParagraphPattern[] {
    const merged = new Map<string, { totalPercentage: number; totalWeight: number; description: string }>();
    
    batchData.forEach(({ patterns, weight }) => {
      patterns.forEach(pattern => {
        const existing = merged.get(pattern.type) || { totalPercentage: 0, totalWeight: 0, description: pattern.description };
        existing.totalPercentage += pattern.percentage * weight;
        existing.totalWeight += weight;
        merged.set(pattern.type, existing);
      });
    });

    return Array.from(merged.entries()).map(([type, data]) => ({
      type,
      percentage: Math.round(data.totalPercentage / data.totalWeight),
      description: data.description
    }));
  }

  private mergePatternsByFrequency<T extends { pattern: string; frequency: number }>(
    batchData: { patterns: T[]; weight: number }[]
  ): T[] {
    const merged = new Map<string, { 
      totalFreq: number; 
      totalWeight: number; 
      original: T;
      contexts: Set<string>;
    }>();
    
    batchData.forEach(({ patterns, weight }) => {
      patterns.forEach(pattern => {
        const existing = merged.get(pattern.pattern);
        if (existing) {
          existing.totalFreq += pattern.frequency * weight;
          existing.totalWeight += weight;
          // Track context variations if pattern has notes
          if ('notes' in pattern && (pattern as any).notes) {
            existing.contexts.add((pattern as any).notes);
          }
        } else {
          merged.set(pattern.pattern, {
            totalFreq: pattern.frequency * weight,
            totalWeight: weight,
            original: pattern,
            contexts: new Set('notes' in pattern && (pattern as any).notes ? [(pattern as any).notes] : [])
          });
        }
      });
    });

    return Array.from(merged.values())
      .map(data => {
        const result: any = {
          ...data.original,
          frequency: data.totalFreq / data.totalWeight
        };
        // Add context information if multiple contexts found
        if (data.contexts.size > 1 && 'notes' in result) {
          result.notes = `Used in ${data.contexts.size} different contexts`;
        }
        return result;
      })
      .sort((a, b) => b.frequency - a.frequency); // Sort by frequency only
  }

  private mergePercentagePatterns<T extends { phrase: string; percentage: number }>(
    batchData: { patterns: T[]; weight: number }[]
  ): T[] {
    const merged = new Map<string, { 
      totalPercentage: number; 
      totalWeight: number; 
      original: T;
    }>();
    
    batchData.forEach(({ patterns, weight }) => {
      patterns.forEach(pattern => {
        const existing = merged.get(pattern.phrase);
        if (existing) {
          existing.totalPercentage += pattern.percentage * weight;
          existing.totalWeight += weight;
        } else {
          merged.set(pattern.phrase, {
            totalPercentage: pattern.percentage * weight,
            totalWeight: weight,
            original: pattern
          });
        }
      });
    });

    return Array.from(merged.values())
      .map(data => ({
        ...data.original,
        percentage: Math.round(data.totalPercentage / data.totalWeight)
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }

  private mergeNegativePatterns(patternArrays: NegativePattern[][]): NegativePattern[] {
    const merged = new Map<string, {
      pattern: NegativePattern;
      occurrences: number;
      contexts: Set<string>;
    }>();
    
    patternArrays.forEach(patterns => {
      patterns.forEach(pattern => {
        // Skip generic template-like patterns
        const genericPatterns = [
          'punctuation patterns like',
          'using all caps',
          'all caps',
          'corporate speak',
          'synergy',
          'circle back',
          'dear',
          'sincerely',
          'best regards',
          'formal greeting',
          'formal sign-off',
          'exclamation marks',
          'multiple exclamation',
          'bullet points',
          'numbered lists',
          'hello',
          'good morning',
          'good afternoon',
          'good evening',
          'regards',
          'kind regards',
          'warm regards',
          'yours truly',
          'respectfully',
          'cordially'
        ];
        
        const isGeneric = genericPatterns.some(generic => 
          pattern.description.toLowerCase().includes(generic.toLowerCase())
        );
        
        if (isGeneric) {
          return; // Skip this pattern
        }
        
        // Create a normalized key to detect duplicates better
        const normalizedKey = pattern.description
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        const existing = merged.get(normalizedKey);
        if (!existing) {
          merged.set(normalizedKey, {
            pattern: { ...pattern },
            occurrences: 1,
            contexts: new Set(pattern.context ? [pattern.context] : [])
          });
        } else {
          existing.occurrences++;
          // Increase confidence with multiple confirmations
          existing.pattern.confidence = Math.min(
            0.99,
            existing.pattern.confidence + (1 - existing.pattern.confidence) * 0.1
          );
          if (pattern.context) {
            existing.contexts.add(pattern.context);
          }
          // Merge examples if available, avoiding duplicates
          if (pattern.examples && existing.pattern.examples) {
            const allExamples = new Set([...existing.pattern.examples, ...pattern.examples]);
            existing.pattern.examples = Array.from(allExamples).slice(0, 3);
          } else if (pattern.examples) {
            existing.pattern.examples = pattern.examples;
          }
        }
      });
    });

    // Include patterns that appear in multiple batches or have high confidence
    return Array.from(merged.values())
      .filter(({ occurrences, pattern }) => 
        occurrences > 1 || pattern.confidence > 0.8
      )
      .map(({ pattern, contexts }) => {
        // Add context variation note if applicable
        if (contexts.size > 1) {
          pattern.context = `Applies across ${contexts.size} different contexts`;
        }
        return pattern;
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Limit to top 10 most confident patterns
  }

  private mergeUniqueExpressions(
    batchData: { expressions: UniqueExpression[]; weight: number }[]
  ): UniqueExpression[] {
    const merged = new Map<string, { 
      totalFreq: number; 
      totalWeight: number; 
      contexts: Map<string, number>; // Context -> weighted frequency
      relationshipTypes: Set<string>;
      originalPhrase: string; // Preserve original casing
    }>();
    
    batchData.forEach(({ expressions, weight }) => {
      expressions.forEach(expr => {
        const key = expr.phrase.toLowerCase();
        const existing = merged.get(key);
        if (existing) {
          existing.totalFreq += expr.frequency * weight;
          existing.totalWeight += weight;
          // Track context frequency
          const contextWeight = existing.contexts.get(expr.context) || 0;
          existing.contexts.set(expr.context, contextWeight + weight);
          // Track that this expression is used in multiple contexts
          // No hardcoded relationship keywords - relationships are dynamic
        } else {
          merged.set(key, {
            totalFreq: expr.frequency * weight,
            totalWeight: weight,
            contexts: new Map([[expr.context, weight]]),
            relationshipTypes: new Set(),  // Relationships come from actual data, not keywords
            originalPhrase: expr.phrase
          });
        }
      });
    });

    return Array.from(merged.entries())
      .map(([_, data]) => {
        // Find primary context (most weighted)
        let primaryContext = '';
        let maxWeight = 0;
        data.contexts.forEach((weight, context) => {
          if (weight > maxWeight) {
            maxWeight = weight;
            primaryContext = context;
          }
        });
        
        // Add context variation note
        if (data.contexts.size > 2) {
          primaryContext += ` (used in ${data.contexts.size} contexts)`;
        }
        
        return {
          phrase: data.originalPhrase,
          context: primaryContext,
          frequency: data.totalFreq / data.totalWeight
        };
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, parseInt(process.env.PATTERN_UNIQUE_EXPRESSIONS_COUNT || '15'));
  }


  private mostCommonStringWeighted(
    items: { value: string; weight: number }[]
  ): string {
    const weightedCounts = new Map<string, number>();
    
    items.forEach(({ value, weight }) => {
      weightedCounts.set(value, (weightedCounts.get(value) || 0) + weight);
    });
    
    let maxWeight = 0;
    let mostCommon = items[0]?.value || '';
    weightedCounts.forEach((weight, value) => {
      if (weight > maxWeight) {
        maxWeight = weight;
        mostCommon = value;
      }
    });
    
    return mostCommon;
  }

  /**
   * Clear existing patterns for a user
   */
  async clearPatterns(userId: string): Promise<void> {
    const query = `
      DELETE FROM tone_preferences 
      WHERE user_id = $1 
        AND profile_data->>'writingPatterns' IS NOT NULL
    `;
    
    await db.query(query, [userId]);
  }

  /**
   * Load patterns from database
   */
  async loadPatterns(
    userId: string,
    relationship?: string
  ): Promise<WritingPatterns | null> {
    const query = `
      SELECT profile_data 
      FROM tone_preferences 
      WHERE user_id = $1 
        AND preference_type = $2 
        AND target_identifier = $3
    `;
    
    const preferenceType = relationship ? 'category' : 'aggregate';
    const targetIdentifier = relationship || 'aggregate';
    
    const result = await db.query(query, [userId, preferenceType, targetIdentifier]);
    if (result.rows.length === 0) {
      return null;
    }

    const data = result.rows[0].profile_data;
    
    if (data?.writingPatterns) {
      return data.writingPatterns as WritingPatterns;
    }
    
    return null;
  }

  /**
   * Save patterns to database
   */
  async savePatterns(
    userId: string,
    patterns: WritingPatterns,
    relationship?: string,
    emailsAnalyzed: number = 1000
  ): Promise<void> {
    const preferenceType = relationship ? 'category' : 'aggregate';
    let targetIdentifier = relationship || 'aggregate';
    let userRelationshipId: string | null = null;
    
    // Create profile data with consistent structure
    const profileData = {
      meta: {
        type: preferenceType,
        lastAnalyzed: new Date().toISOString(),
        emailCount: emailsAnalyzed,
        confidence: emailsAnalyzed > 50 ? 0.95 : 0.8 // Higher confidence with more emails
      },
      writingPatterns: patterns
    };

    if (relationship) {
      // Ensure the relationship exists in user_relationships
      const displayName = relationship.charAt(0).toUpperCase() + relationship.slice(1);
      
      const relationshipResult = await db.query(`
        INSERT INTO user_relationships (user_id, relationship_type, display_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, relationship_type) 
        DO UPDATE SET display_name = $3
        RETURNING id
      `, [userId, relationship, displayName]);
      
      userRelationshipId = relationshipResult.rows[0].id;
    }
    
    // Save to unified tone_preferences table
    const query = `
      INSERT INTO tone_preferences (
        user_id, 
        preference_type, 
        target_identifier,
        user_relationship_id,
        profile_data, 
        emails_analyzed, 
        last_updated
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id, preference_type, target_identifier)
      DO UPDATE SET 
        user_relationship_id = $4,
        profile_data = $5,
        emails_analyzed = $6,
        last_updated = NOW()
    `;
    
    await db.query(query, [
      userId, 
      preferenceType, 
      targetIdentifier,
      userRelationshipId,
      JSON.stringify(profileData), 
      emailsAnalyzed
    ]);
  }
}