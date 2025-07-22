import { Pool } from 'pg';
import { VectorStore } from '../vector/qdrant-client';
import { EmailFeatures } from '../nlp-feature-extractor';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb'
});

export interface AggregatedStyle {
  greetings: Array<{ text: string; frequency: number; percentage: number }>;
  closings: Array<{ text: string; frequency: number; percentage: number }>;
  emojis: Array<{ emoji: string; frequency: number; contexts: string[] }>;
  contractions: { uses: boolean; frequency: number; examples: string[] };
  sentimentProfile: { 
    primaryTone: string; 
    averageWarmth: number; 
    averageFormality: number; 
  };
  vocabularyProfile: {
    complexityLevel: string;
    technicalTerms: string[];
    commonPhrases: Array<{ phrase: string; frequency: number }>;
  };
  structuralPatterns: {
    averageEmailLength: number;
    averageSentenceLength: number;
    paragraphingStyle: string;
  };
  // Metadata for continuous learning
  emailCount: number;
  lastUpdated: string;
  confidenceScore: number;
}

export class StyleAggregationService {
  constructor(
    private vectorStore: VectorStore,
    private customPool: Pool = pool
  ) {}

  async aggregateStyleForUser(
    userId: string,
    relationshipType: string
  ): Promise<AggregatedStyle> {
    // Query emails for THIS user and THIS relationship type
    const searchResults = await this.vectorStore.searchSimilar({
      userId: userId,
      queryVector: new Array(384).fill(0), // Dummy vector to get all matches
      relationship: relationshipType,
      limit: 1000, // Get all user's emails for this relationship
      scoreThreshold: 0 // Get all matches
    });
    
    // Aggregate patterns
    const greetingMap = new Map<string, number>();
    const closingMap = new Map<string, number>();
    const emojiMap = new Map<string, Set<string>>();
    const phraseMap = new Map<string, number>();
    const contractionExamples = new Set<string>();
    
    let totalWarmth = 0;
    let totalFormality = 0;
    let totalWords = 0;
    let totalSentences = 0;
    let usesContractions = 0;
    
    for (const result of searchResults) {
      const features = result.metadata.features as EmailFeatures;
      
      // Aggregate greetings from relationship hints
      if (features.relationshipHints?.linguisticMarkers?.greetingStyle) {
        const greeting = features.relationshipHints.linguisticMarkers.greetingStyle;
        const count = greetingMap.get(greeting) || 0;
        greetingMap.set(greeting, count + 1);
      }
      
      // Aggregate closings
      if (features.closings && features.closings.length > 0) {
        features.closings.forEach(closing => {
          const count = closingMap.get(closing.text) || 0;
          closingMap.set(closing.text, count + closing.count);
        });
      }
      
      // Also check closing style from relationship hints
      if (features.relationshipHints?.linguisticMarkers?.closingStyle) {
        const closing = features.relationshipHints.linguisticMarkers.closingStyle;
        const count = closingMap.get(closing) || 0;
        closingMap.set(closing, count + 1);
      }
      
      // Aggregate emojis with context
      features.sentiment.emojis?.forEach((emoji: string) => {
        if (!emojiMap.has(emoji)) {
          emojiMap.set(emoji, new Set());
        }
        emojiMap.get(emoji)!.add(features.sentiment.primary);
      });
      
      // Aggregate contractions
      if (features.contractions && features.contractions.length > 0) {
        usesContractions++;
        // Get actual contraction examples
        features.contractions.forEach(c => {
          if (contractionExamples.size < 10) {
            contractionExamples.add(c.contraction);
          }
        });
      }
      
      // Aggregate phrases (2+ words, frequency > 1)
      features.phrases
        .filter((p: any) => p.text.split(' ').length >= 2 && p.frequency > 1)
        .forEach((phrase: any) => {
          const count = phraseMap.get(phrase.text) || 0;
          phraseMap.set(phrase.text, count + phrase.frequency);
        });
      
      // Aggregate metrics
      totalWarmth += features.tonalQualities.warmth;
      totalFormality += features.tonalQualities.formality;
      totalWords += features.stats.wordCount;
      totalSentences += features.stats.sentenceCount;
    }
    
    const emailCount = searchResults.length;
    if (emailCount === 0) {
      return this.getDefaultStyle(relationshipType);
    }
    
    // Convert to sorted arrays with percentages
    const sortedGreetings = Array.from(greetingMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([text, frequency]) => ({
        text,
        frequency,
        percentage: Math.round((frequency / emailCount) * 100)
      }));
    
    const sortedClosings = Array.from(closingMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([text, frequency]) => ({
        text,
        frequency,
        percentage: Math.round((frequency / emailCount) * 100)
      }));
    
    const sortedEmojis = Array.from(emojiMap.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 20)
      .map(([emoji, contexts]) => ({
        emoji,
        frequency: contexts.size,
        contexts: Array.from(contexts)
      }));
    
    const sortedPhrases = Array.from(phraseMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([phrase, frequency]) => ({ phrase, frequency }));
    
    return {
      greetings: sortedGreetings,
      closings: sortedClosings,
      emojis: sortedEmojis,
      contractions: {
        uses: usesContractions > emailCount * 0.3,
        frequency: usesContractions,
        examples: Array.from(contractionExamples).slice(0, 10)
      },
      sentimentProfile: {
        primaryTone: this.determinePrimaryTone(totalWarmth / emailCount),
        averageWarmth: totalWarmth / emailCount,
        averageFormality: totalFormality / emailCount
      },
      vocabularyProfile: {
        complexityLevel: this.determineComplexityLevel(totalWords / totalSentences),
        technicalTerms: [], // Could extract from features if needed
        commonPhrases: sortedPhrases
      },
      structuralPatterns: {
        averageEmailLength: totalWords / emailCount,
        averageSentenceLength: totalWords / totalSentences,
        paragraphingStyle: 'single' // Could analyze paragraph patterns
      },
      emailCount,
      lastUpdated: new Date().toISOString(),
      confidenceScore: this.calculateConfidence(emailCount)
    };
  }
  
  async updateStylePreferences(
    userId: string,
    relationshipType: string,
    aggregatedStyle: AggregatedStyle
  ): Promise<void> {
    await this.customPool.query(
      `INSERT INTO relationship_tone_preferences (user_id, relationship_type, style_preferences, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id, relationship_type) 
       DO UPDATE SET 
         style_preferences = $3,
         updated_at = NOW()`,
      [userId, relationshipType, JSON.stringify(aggregatedStyle)]
    );
  }
  
  async getAggregatedStyle(userId: string, relationshipType: string): Promise<AggregatedStyle | null> {
    const result = await this.customPool.query(
      `SELECT style_preferences 
       FROM relationship_tone_preferences 
       WHERE user_id = $1 AND relationship_type = $2`,
      [userId, relationshipType]
    );
    
    if (result.rows.length > 0 && result.rows[0].style_preferences) {
      return result.rows[0].style_preferences as AggregatedStyle;
    }
    
    return null;
  }
  
  private calculateConfidence(emailCount: number): number {
    // Confidence increases with sample size
    if (emailCount < 10) return 0.2;
    if (emailCount < 50) return 0.4;
    if (emailCount < 100) return 0.6;
    if (emailCount < 500) return 0.8;
    return 0.95;
  }
  
  private determinePrimaryTone(warmth: number): string {
    if (warmth > 0.8) return 'very warm';
    if (warmth > 0.6) return 'warm';
    if (warmth > 0.4) return 'neutral';
    if (warmth > 0.2) return 'professional';
    return 'formal';
  }
  
  private determineComplexityLevel(avgSentenceLength: number): string {
    if (avgSentenceLength < 10) return 'simple';
    if (avgSentenceLength < 15) return 'moderate';
    if (avgSentenceLength < 20) return 'complex';
    return 'very complex';
  }
  
  private getDefaultStyle(_relationshipType: string): AggregatedStyle {
    // Return minimal default style when no data exists
    return {
      greetings: [],
      closings: [],
      emojis: [],
      contractions: {
        uses: false,
        frequency: 0,
        examples: []
      },
      sentimentProfile: {
        primaryTone: 'neutral',
        averageWarmth: 0.5,
        averageFormality: 0.5
      },
      vocabularyProfile: {
        complexityLevel: 'moderate',
        technicalTerms: [],
        commonPhrases: []
      },
      structuralPatterns: {
        averageEmailLength: 100,
        averageSentenceLength: 15,
        paragraphingStyle: 'single'
      },
      emailCount: 0,
      lastUpdated: new Date().toISOString(),
      confidenceScore: 0
    };
  }
  
  async getUserRelationshipTypes(userId: string): Promise<Array<{
    relationshipType: string;
    hasAggregatedStyle: boolean;
    emailCount?: number;
    lastUpdated?: string;
  }>> {
    // Get all relationship types from user_relationships
    const relationshipsResult = await this.customPool.query(
      `SELECT DISTINCT relationship_type, display_name 
       FROM user_relationships 
       WHERE user_id = $1 AND is_active = true
       ORDER BY relationship_type`,
      [userId]
    );
    
    // Get aggregated styles
    const stylesResult = await this.customPool.query(
      `SELECT relationship_type, style_preferences 
       FROM relationship_tone_preferences 
       WHERE user_id = $1`,
      [userId]
    );
    
    const styleMap = new Map<string, any>();
    for (const row of stylesResult.rows) {
      const style = row.style_preferences;
      if (style && 'emailCount' in style) {
        styleMap.set(row.relationship_type, style);
      }
    }
    
    return relationshipsResult.rows.map(row => ({
      relationshipType: row.relationship_type,
      displayName: row.display_name,
      hasAggregatedStyle: styleMap.has(row.relationship_type),
      emailCount: styleMap.get(row.relationship_type)?.emailCount,
      lastUpdated: styleMap.get(row.relationship_type)?.lastUpdated
    }));
  }
}

// Export singleton instance
export const styleAggregationService = new StyleAggregationService(new VectorStore());