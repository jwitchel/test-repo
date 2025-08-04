import { extractEmailFeatures, ProcessedEmail } from './types';
import { VectorStore } from '../vector/qdrant-client';
import { EmbeddingService } from '../vector/embedding-service';
import { RelationshipDetector } from '../relationships/relationship-detector';
import { withRetry } from './retry-utils';
import { StyleAggregationService } from '../style/style-aggregation-service';

export interface BatchResult {
  success: number;
  errors: number;
  relationships: string[];
}

export class EmailIngestPipeline {
  constructor(
    private vectorStore: VectorStore,
    private embeddingService: EmbeddingService,
    private relationshipDetector: RelationshipDetector,
    private styleAggregation: StyleAggregationService,
    private config: {
      batchSize: number;
      parallelism: number;
      errorThreshold: number;
    }
  ) {}
  
  async processHistoricalEmails(userId: string, _emailAccountId: string, emails?: ProcessedEmail[]) {
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;
    const relationshipStats: Record<string, number> = {};
    
    try {
      // For now, we'll process emails passed in directly
      // In the future, this will stream from IMAP
      if (!emails || emails.length === 0) {
        console.log('No emails provided for processing');
        return {
          processed: 0,
          errors: 0,
          duration: Date.now() - startTime,
          relationshipDistribution: {}
        };
      }
      
      for await (const batch of this.batchStream(this.asyncIterableFromArray(emails), this.config.batchSize)) {
        const results = await this.processBatch(userId, batch);
        
        processed += results.success;
        errors += results.errors;
        
        results.relationships.forEach(rel => {
          relationshipStats[rel] = (relationshipStats[rel] || 0) + 1;
        });
        
        if (processed > 0 && errors / processed > this.config.errorThreshold) {
          throw new Error(`Error rate exceeded threshold: ${errors}/${processed}`);
        }
        
        if (processed % 100 === 0) {
          console.log(`Processed ${processed} emails. Relationships: ${JSON.stringify(relationshipStats)}`);
        }
      }
      
      console.log(`Historical processing complete. Total: ${processed}, Errors: ${errors}`);
      console.log('Relationship distribution:', relationshipStats);
      
      // Aggregate styles for each relationship type after all emails are processed
      console.log('Aggregating styles for each relationship type...');
      for (const [relationshipType, count] of Object.entries(relationshipStats)) {
        if (count > 0) {
          try {
            const aggregated = await this.styleAggregation.aggregateStyleForUser(userId, relationshipType);
            await this.styleAggregation.updateStylePreferences(userId, relationshipType, aggregated);
            console.log(`Updated style for ${userId} -> ${relationshipType}: ${aggregated.emailCount} emails`);
          } catch (error: any) {
            if (error.code !== '23503') { // PostgreSQL foreign key violation
              console.error(`Style aggregation failed for ${relationshipType}:`, error);
            }
          }
        }
      }
      
      return {
        processed,
        errors,
        duration: Date.now() - startTime,
        relationshipDistribution: relationshipStats
      };
      
    } catch (error) {
      console.error('Pipeline failed:', error);
      throw error;
    }
  }

  private async *asyncIterableFromArray<T>(items: T[]): AsyncIterable<T> {
    for (const item of items) {
      yield item;
    }
  }
  
  private async processBatch(userId: string, emails: ProcessedEmail[]): Promise<BatchResult> {
    const tasks = emails.map(email => this.processEmail(userId, email));
    const results = await Promise.allSettled(tasks);
    
    const successful = results.filter(r => r.status === 'fulfilled');
    const relationships = successful.map(r => 
      (r as PromiseFulfilledResult<any>).value.relationship
    );
    
    return {
      success: successful.length,
      errors: results.filter(r => r.status === 'rejected').length,
      relationships
    };
  }
  
  async processEmail(userId: string, email: ProcessedEmail) {
    // Extract NLP features
    const features = extractEmailFeatures(email.extractedText, {
      email: email.to[0]?.address || '',
      name: email.to[0]?.name || ''
    });
    
    // Detect relationship - use existing relationship if provided (e.g., from test data)
    let relationship: { relationship: string; confidence: number; method: string };
    
    if (email.relationship?.type) {
      // Use the relationship from the email if it's already set
      relationship = {
        relationship: email.relationship.type,
        confidence: email.relationship.confidence,
        method: email.relationship.detectionMethod
      };
    } else {
      // Otherwise, detect it
      relationship = await this.relationshipDetector.detectRelationship({
        userId,
        recipientEmail: email.to[0]?.address || '',
        subject: email.subject,
        historicalContext: {
          familiarityLevel: features.relationshipHints.familiarityLevel,
          hasIntimacyMarkers: features.relationshipHints.intimacyMarkers.length > 0,
          hasProfessionalMarkers: features.relationshipHints.professionalMarkers.length > 0,
          formalityScore: features.stats.formalityScore
        }
      });
    }
    
    // Generate embedding with retry
    const { vector } = await withRetry(
      () => this.embeddingService.embedText(email.extractedText),
      {
        onRetry: (error, attempt) => {
          console.warn(`Embedding generation failed (attempt ${attempt}):`, error.message);
        }
      }
    );
    
    // Store in vector database with retry
    await withRetry(
      () => this.vectorStore.upsertEmail({
      id: email.messageId,
      userId,
      vector,
      metadata: {
        emailId: email.messageId,
        userId,
        extractedText: email.extractedText,
        rawText: email.textContent || email.extractedText, // Store original text
        recipientEmail: email.to[0]?.address || '',
        subject: email.subject,
        sentDate: email.date.toISOString(),
        features,
        relationship: {
          type: relationship.relationship,
          confidence: relationship.confidence,
          detectionMethod: relationship.method
        },
        frequencyScore: 1,
        wordCount: features.stats.wordCount
      }
    }),
      {
        onRetry: (error, attempt) => {
          console.warn(`Vector store operation failed (attempt ${attempt}):`, error.message);
        }
      }
    );
    
    // Style aggregation should be done once after all emails are processed,
    // not for every single email. Commenting out to prevent inefficiency and race conditions.
    // TODO: Move style aggregation to happen once per relationship after batch processing
    
    // setImmediate(async () => {
    //   try {
    //     const aggregated = await this.styleAggregation
    //       .aggregateStyleForUser(userId, relationship.relationship);
    //     
    //     await this.styleAggregation.updateStylePreferences(
    //       userId,
    //       relationship.relationship,
    //       aggregated
    //     );
    //     
    //     console.log(`Updated style for ${userId} -> ${relationship.relationship}: ${aggregated.emailCount} emails`);
    //   } catch (error: any) {
    //     // Only log real errors, not foreign key violations from test data
    //     if (error.code !== '23503') { // PostgreSQL foreign key violation
    //       console.error('Style aggregation failed:', error);
    //     }
    //   }
    // });
    
    return { relationship: relationship.relationship };
  }

  private async *batchStream<T>(
    stream: AsyncIterable<T>,
    batchSize: number
  ): AsyncGenerator<T[], void, unknown> {
    let batch: T[] = [];
    
    for await (const item of stream) {
      batch.push(item);
      
      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }
    
    if (batch.length > 0) {
      yield batch;
    }
  }
}