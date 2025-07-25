import { VectorStore } from '../vector/qdrant-client';
import { EmbeddingService } from '../vector/embedding-service';
import { ExampleSelector } from './example-selector';
import { PromptFormatterV2 } from './prompt-formatter-v2';
import { EmailIngestPipeline } from './email-ingest-pipeline';
import { ProcessedEmail, GeneratedDraft } from './types';
import { RelationshipService } from '../relationships/relationship-service';
import { RelationshipDetector } from '../relationships/relationship-detector';
import { StyleAggregationService } from '../style/style-aggregation-service';
import chalk from 'chalk';

export interface ToneLearningConfig {
  userId: string;
  maxExamples?: number;
  templateName?: string;
  verbose?: boolean;
}

export interface DraftGenerationRequest {
  incomingEmail: ProcessedEmail;
  recipientEmail: string;
  config?: Partial<ToneLearningConfig>;
}

export class ToneLearningOrchestrator {
  private vectorStore: VectorStore;
  private embeddingService: EmbeddingService;
  private relationshipService: RelationshipService;
  private relationshipDetector: RelationshipDetector;
  private styleAggregationService: StyleAggregationService;
  private exampleSelector: ExampleSelector;
  private promptFormatter: PromptFormatterV2;
  private ingestionPipeline: EmailIngestPipeline;
  
  constructor() {
    this.vectorStore = new VectorStore();
    this.embeddingService = new EmbeddingService();
    this.relationshipService = new RelationshipService();
    this.relationshipDetector = new RelationshipDetector();
    this.styleAggregationService = new StyleAggregationService(this.vectorStore);
    this.exampleSelector = new ExampleSelector(
      this.vectorStore, 
      this.embeddingService,
      this.relationshipService,
      this.relationshipDetector
    );
    this.promptFormatter = new PromptFormatterV2();
    this.ingestionPipeline = new EmailIngestPipeline(
      this.vectorStore,
      this.embeddingService,
      this.relationshipDetector,
      this.styleAggregationService,
      { 
        batchSize: parseInt(process.env.PIPELINE_BATCH_SIZE || '100'),
        parallelism: parseInt(process.env.PIPELINE_PARALLELISM || '5'),
        errorThreshold: parseFloat(process.env.PIPELINE_ERROR_THRESHOLD || '0.1')
      }
    );
  }
  
  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    await this.embeddingService.initialize();
    await this.promptFormatter.initialize();
  }
  
  /**
   * Ingest a batch of historical emails
   */
  async ingestHistoricalEmails(
    userId: string,
    emailAccountId: string,
    emails: ProcessedEmail[]
  ): Promise<{ processed: number; errors: number; duration: number; relationshipDistribution: Record<string, number> }> {
    if (process.env.NODE_ENV !== 'test') {
      console.log(chalk.blue(`📥 Ingesting ${emails.length} historical emails...`));
    }
    
    const result = await this.ingestionPipeline.processHistoricalEmails(
      userId,
      emailAccountId,
      emails
    );
    
    if (process.env.NODE_ENV !== 'test') {
      console.log(chalk.green('✅ Historical emails ingested'));
    }
    
    return result;
  }
  
  /**
   * Ingest a single email sequentially - bypasses batching
   */
  async ingestSingleEmail(
    userId: string,
    _emailAccountId: string,
    email: ProcessedEmail
  ): Promise<{ processed: number; errors: number }> {
    try {
      // Process the email directly without batching
      await this.ingestionPipeline.processEmail(userId, email);
      return { processed: 1, errors: 0 };
    } catch (error) {
      console.error('Error processing single email:', error);
      return { processed: 0, errors: 1 };
    }
  }
  
  /**
   * Aggregate styles for all relationship types for a user
   */
  async aggregateStyles(userId: string): Promise<void> {
    // Get all relationship types that have emails
    const relationshipTypes = ['friend', 'colleague', 'acquaintance', 'client', 'customer', 'vendor'];
    
    for (const relationshipType of relationshipTypes) {
      try {
        const aggregated = await this.styleAggregationService.aggregateStyleForUser(userId, relationshipType);
        if (aggregated.emailCount > 0) {
          await this.styleAggregationService.updateStylePreferences(userId, relationshipType, aggregated);
          console.log(`Updated style for ${relationshipType}: ${aggregated.emailCount} emails`);
        }
      } catch (error: any) {
        if (error.code !== '23503') { // PostgreSQL foreign key violation
          console.error(`Style aggregation failed for ${relationshipType}:`, error);
        }
      }
    }
  }
  
  /**
   * Generate a draft reply using learned tone
   */
  async generateDraft(request: DraftGenerationRequest): Promise<GeneratedDraft> {
    const {
      incomingEmail,
      recipientEmail,
      config = {}
    } = request;
    
    const {
      userId,
      maxExamples = parseInt(process.env.EXAMPLE_COUNT || '25'),
      templateName = 'default',
      verbose = false
    } = config;
    
    if (!userId) {
      throw new Error('userId is required in config');
    }
    
    if (verbose) {
      console.log(chalk.bold('\n🤖 Generating Draft Reply\n'));
      console.log(chalk.gray('Incoming email:'));
      console.log(chalk.gray(`  From: ${incomingEmail.from[0]?.address}`));
      console.log(chalk.gray(`  Subject: ${incomingEmail.subject}`));
      console.log(chalk.gray(`  Text: ${incomingEmail.extractedText.substring(0, 100)}...`));
    }
    
    // Step 1: Select relevant examples
    if (verbose) {
      console.log(chalk.blue('\n1️⃣ Selecting examples...'));
    }
    
    const exampleSelection = await this.exampleSelector.selectExamples({
      userId,
      incomingEmail: incomingEmail.extractedText,
      recipientEmail,
      desiredCount: maxExamples
    });
    
    // Get the detected relationship
    const detectedRelationship = await this.relationshipDetector.detectRelationship({
      userId,
      recipientEmail
    });
    
    if (verbose) {
      console.log(chalk.gray(`  Found ${exampleSelection.examples.length} relevant examples`));
      console.log(chalk.gray(`  Primary relationship: ${exampleSelection.relationship}`));
      console.log(chalk.gray(`  Confidence: ${(detectedRelationship.confidence * 100).toFixed(1)}%`));
    }
    
    // Get enhanced profile with aggregated style
    const enhancedProfile = await this.relationshipService.getEnhancedProfile(
      userId,
      recipientEmail
    );
    
    // Step 2: Format prompt with examples
    if (verbose) {
      console.log(chalk.blue('\n2️⃣ Formatting prompt...'));
      if (enhancedProfile?.aggregatedStyle) {
        console.log(chalk.gray(`  Using aggregated style from ${enhancedProfile.aggregatedStyle.emailCount} emails`));
      }
    }
    
    const prompt = await this.promptFormatter.formatWithExamples({
      incomingEmail: incomingEmail.extractedText,
      recipientEmail,
      examples: exampleSelection.examples,
      relationship: exampleSelection.relationship,
      relationshipProfile: enhancedProfile
    });
    
    if (verbose) {
      console.log(chalk.gray(`  Template: ${templateName}`));
      console.log(chalk.gray(`  Prompt length: ${prompt.length} characters`));
    }
    
    // Step 3: Generate draft (placeholder for actual LLM call)
    if (verbose) {
      console.log(chalk.blue('\n3️⃣ Generating draft...'));
    }
    
    // TODO: Integrate with actual LLM service
    const draft: GeneratedDraft = {
      id: `draft-${Date.now()}`,
      userId,
      incomingEmailId: incomingEmail.uid,
      recipientEmail,
      subject: `Re: ${incomingEmail.subject}`,
      body: '// Draft would be generated by LLM here using the formatted prompt',
      relationship: {
        type: exampleSelection.relationship,
        confidence: detectedRelationship.confidence,
        detectionMethod: detectedRelationship.method
      },
      examplesUsed: exampleSelection.examples.map(e => e.id),
      metadata: {
        promptTemplate: templateName,
        exampleCount: exampleSelection.examples.length,
        diversityScore: exampleSelection.stats.diversityScore,
        timestamp: new Date().toISOString()
      },
      createdAt: new Date()
    };
    
    if (verbose) {
      console.log(chalk.green('\n✅ Draft generated successfully!\n'));
      console.log(chalk.bold('Generated Prompt:'));
      console.log(chalk.gray('─'.repeat(80)));
      console.log(prompt);
      console.log(chalk.gray('─'.repeat(80)));
    }
    
    return draft;
  }
  
  /**
   * Process feedback on a generated draft
   */
  async processDraftFeedback(
    _draftId: string,
    _feedback: {
      edited: boolean;
      editDistance?: number;
      accepted: boolean;
      userRating?: number;
    }
  ): Promise<void> {
    // TODO: Implement feedback processing
    // This would update the usage statistics in the vector store
    console.log(chalk.yellow('📝 Feedback processing not yet implemented'));
  }
  
  /**
   * Load test data (John's emails)
   * @deprecated Use seed-demo.ts instead
   */
  async loadTestData(_userId: string = 'john-test-user'): Promise<void> {
    console.log('loadTestData is deprecated. Use npm run seed instead.');
  }
  
  /**
   * Clear all data for a user
   */
  async clearUserData(userId: string): Promise<void> {
    await this.vectorStore.deleteUserData(userId);
  }
  
  /**
   * Get statistics about learned tone
   */
  async getToneStatistics(userId: string): Promise<{
    totalEmails: number;
    relationships: Record<string, number>;
    exampleUsage: Map<string, { used: number; rating: number }>;
  }> {
    const relationshipStats = await this.vectorStore.getRelationshipStats(userId);
    const totalEmails = Object.values(relationshipStats).reduce((a, b) => a + b, 0);
    
    // TODO: Get example usage statistics from usage tracker
    const exampleUsage = new Map();
    
    return {
      totalEmails,
      relationships: relationshipStats,
      exampleUsage
    };
  }
}