import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';

dotenv.config();

export interface EmailMetadata {
  emailId: string;
  userId: string;
  rawText?: string;           // Original email with signature (optional for backward compat)
  userReply?: string;         // Just what the user wrote (no quotes, no signatures)
  respondedTo?: string;       // The quoted content the user was responding to
  redactedNames?: string[];   // Names that were redacted from the email
  redactedEmails?: string[];  // Email addresses that were redacted
  recipientEmail: string;
  subject: string;
  sentDate: string;
  features: any; // NLP features from feature extraction
  relationship: {
    type: string;
    confidence: number;
    detectionMethod: string;
  };
  frequencyScore: number;
  wordCount: number;
  responseTimeMinutes?: number;
}

export interface EmailVector {
  id: string;
  vector: number[];
  metadata: EmailMetadata;
  score?: number;
}

export interface VectorSearchParams {
  userId: string;
  queryVector: number[];
  relationship?: string;
  recipientEmail?: string;  // Filter by specific recipient for direct correspondence
  limit?: number;
  scoreThreshold?: number;
  excludeIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface UsageUpdate {
  vectorId: string;
  wasUsed: boolean;
  wasEdited: boolean;
  editDistance?: number;
  userRating?: number;
}

export class VectorStore {
  private client: QdrantClient;
  private collectionName = 'user-emails';
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const url = process.env.QDRANT_URL || 'http://localhost:6333';
    const apiKey = process.env.QDRANT_API_KEY;
    
    this.client = new QdrantClient({
      url,
      apiKey: apiKey || undefined,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    await this.initPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      console.log('Initializing Qdrant vector store...');
      
      // Check if collection exists
      const collections = await this.client.getCollections();
      if (!collections || !collections.collections) {
        throw new Error('Failed to get collections from Qdrant');
      }
      const exists = collections.collections.some(c => c.name === this.collectionName);

      if (!exists) {
        console.log(`Creating collection: ${this.collectionName}`);
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 384,
            distance: 'Cosine'
          },
          optimizers_config: {
            indexing_threshold: 0,  // Index immediately for testing
          }
        });

        // Indexes are created automatically in Qdrant when filtering on fields
        console.log('Collection created with automatic indexing');
      }

      this.initialized = true;
      console.log('Qdrant vector store initialized');
    } catch (error) {
      this.initPromise = null;
      throw new Error(`Failed to initialize Qdrant: ${error}`);
    }
  }

  async upsertEmail(email: {
    id: string;
    userId: string;
    vector: number[];
    metadata: EmailMetadata;
  }): Promise<void> {
    await this.initialize();

    try {
      // Generate a numeric ID from string ID using hash
      const numericId = this.stringToNumericId(email.id);
      
      await this.client.upsert(this.collectionName, {
        points: [{
          id: numericId,
          vector: email.vector,
          payload: {
            ...email.metadata,
            userId: email.userId,
            indexedAt: new Date().toISOString(),
            originalId: email.id // Store original string ID
          }
        }]
      });
    } catch (error) {
      throw new Error(`Failed to upsert email vector: ${error}`);
    }
  }

  private stringToNumericId(str: string): number {
    // Simple hash function to convert string to number
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  async upsertBatch(emails: Array<{
    id: string;
    userId: string;
    vector: number[];
    metadata: EmailMetadata;
  }>): Promise<void> {
    await this.initialize();

    if (emails.length === 0) return;

    try {
      const points = emails.map(email => ({
        id: this.stringToNumericId(email.id),
        vector: email.vector,
        payload: {
          ...email.metadata,
          userId: email.userId,
          indexedAt: new Date().toISOString(),
          originalId: email.id
        }
      }));

      // Upsert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        await this.client.upsert(this.collectionName, { points: batch });
      }

      console.log(`Upserted ${emails.length} email vectors`);
    } catch (error) {
      throw new Error(`Failed to upsert batch: ${error}`);
    }
  }

  async searchSimilar(params: VectorSearchParams): Promise<EmailVector[]> {
    await this.initialize();

    const limit = params.limit || parseInt(process.env.VECTOR_SEARCH_LIMIT || '50');
    const scoreThreshold = params.scoreThreshold || parseFloat(process.env.VECTOR_SCORE_THRESHOLD || '0.3');
    
    console.log(`[VectorStore searchSimilar] Called with:`, {
      userId: params.userId,
      hasVector: params.queryVector ? 'yes' : 'no',
      vectorLength: params.queryVector?.length,
      relationship: params.relationship,
      recipientEmail: params.recipientEmail,
      limit,
      scoreThreshold
    });

    // Build filter conditions
    const must: any[] = [
      { key: 'userId', match: { value: params.userId } }
    ];

    // CRITICAL: Relationship filter is PRIMARY
    if (params.relationship) {
      must.push({
        key: 'relationship.type',
        match: { value: params.relationship }
      });
    }

    // Filter by specific recipient email for direct correspondence
    if (params.recipientEmail) {
      must.push({
        key: 'recipientEmail',
        match: { value: params.recipientEmail }
      });
    }

    if (params.excludeIds && params.excludeIds.length > 0) {
      must.push({
        key: 'emailId',
        match: { 
          except: params.excludeIds 
        }
      });
    }

    if (params.dateRange) {
      must.push({
        key: 'sentDate',
        range: {
          gte: params.dateRange.start.toISOString(),
          lte: params.dateRange.end.toISOString()
        }
      });
    }

    try {
      const searchParams: any = {
        vector: params.queryVector,
        limit,
        score_threshold: scoreThreshold,
        with_payload: true,
        with_vector: false
      };

      if (must.length > 0) {
        searchParams.filter = { must };
      }

      const results = await this.client.search(this.collectionName, searchParams);
      
      console.log(`[VectorStore searchSimilar] Results:`, {
        count: results.length,
        scores: results.map(r => r.score),
        firstFewIds: results.slice(0, 3).map(r => (r.payload as any).emailId)
      });

      return results.map(result => ({
        id: (result.payload as any).originalId || String(result.id),
        vector: [], // Not returning vectors to save memory
        metadata: result.payload as unknown as EmailMetadata,
        score: result.score
      }));
    } catch (error) {
      throw new Error(`Vector search failed: ${error}`);
    }
  }

  async findNearDuplicates(
    userId: string, 
    vector: number[], 
    threshold?: number
  ): Promise<EmailVector[]> {
    const nearDuplicateThreshold = threshold || parseFloat(process.env.NEAR_DUPLICATE_THRESHOLD || '0.98');
    
    return this.searchSimilar({
      userId,
      queryVector: vector,
      limit: 10,
      scoreThreshold: nearDuplicateThreshold
    });
  }

  async getByRelationship(
    userId: string, 
    relationship: string, 
    limit?: number
  ): Promise<EmailVector[]> {
    await this.initialize();

    const searchLimit = limit || 100;

    try {
      // For aggregate, get ALL emails for the user (no relationship filter)
      const filter = relationship === 'aggregate' 
        ? {
            must: [
              { key: 'userId', match: { value: userId } }
            ]
          }
        : {
            must: [
              { key: 'userId', match: { value: userId } },
              { key: 'relationship.type', match: { value: relationship } }
            ]
          };

      const results = await this.client.scroll(this.collectionName, {
        filter,
        limit: searchLimit,
        with_payload: true,
        with_vector: false
      });

      return results.points.map(point => ({
        id: (point.payload as any).originalId || String(point.id),
        vector: [],
        metadata: point.payload as unknown as EmailMetadata
      }));
    } catch (error) {
      throw new Error(`Failed to get emails by relationship: ${error}`);
    }
  }

  async debugUserEmails(userId: string, limit: number = 5): Promise<void> {
    await this.initialize();
    
    try {
      // Get a few emails for this user to debug
      const results = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'userId', match: { value: userId } }
          ]
        },
        limit,
        with_payload: true,
        with_vector: true
      });
      
      console.log(`[VectorStore Debug] Found ${results.points.length} emails for userId: ${userId}`);
      results.points.forEach((point, idx) => {
        const payload = point.payload as any;
        console.log(`[VectorStore Debug] Email ${idx + 1}:`, {
          id: payload.emailId,
          userId: payload.userId,
          recipientEmail: payload.recipientEmail,
          relationship: payload.relationship,
          subject: payload.subject?.substring(0, 50) + '...',
          hasVector: point.vector ? 'yes' : 'no',
          vectorLength: point.vector ? (Array.isArray(point.vector) ? point.vector.length : 'object') : 0
        });
      });
      
      // Also check total count without userId filter
      const allResults = await this.client.scroll(this.collectionName, {
        limit: 1000,
        with_payload: false,
        with_vector: false
      });
      
      console.log(`[VectorStore Debug] Total emails in collection: ${allResults.points.length}`);
    } catch (error) {
      console.error('[VectorStore Debug] Error:', error);
    }
  }

  async getRelationshipStats(userId: string): Promise<Record<string, number>> {
    await this.initialize();

    try {
      // Get all emails for user
      const results = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'userId', match: { value: userId } }
          ]
        },
        limit: 10000,
        with_payload: ['relationship.type'],
        with_vector: false
      });

      // Count by relationship
      const stats: Record<string, number> = {};
      results.points.forEach(point => {
        const relationship = (point.payload as any)?.relationship?.type;
        if (relationship) {
          stats[relationship] = (stats[relationship] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      throw new Error(`Failed to get relationship stats: ${error}`);
    }
  }

  async updateUsageStats(updates: UsageUpdate[]): Promise<void> {
    await this.initialize();

    try {
      for (const update of updates) {
        // Get current point
        const numericId = this.stringToNumericId(update.vectorId);
        const points = await this.client.retrieve(this.collectionName, {
          ids: [numericId],
          with_payload: true
        });

        if (points.length === 0) continue;

        const currentPayload = points[0].payload as any;
        
        // Update frequency and usage stats
        const newPayload = {
          ...currentPayload,
          frequencyScore: (currentPayload.frequencyScore || 1) + (update.wasUsed ? 1 : 0),
          lastUsedAt: update.wasUsed ? new Date().toISOString() : currentPayload.lastUsedAt,
          editCount: (currentPayload.editCount || 0) + (update.wasEdited ? 1 : 0),
          averageEditDistance: update.editDistance 
            ? ((currentPayload.averageEditDistance || 0) * (currentPayload.editCount || 0) + update.editDistance) / ((currentPayload.editCount || 0) + 1)
            : currentPayload.averageEditDistance,
          userRating: update.userRating || currentPayload.userRating
        };

        await this.client.setPayload(this.collectionName, {
          points: [numericId],
          payload: newPayload
        });
      }
    } catch (error) {
      throw new Error(`Failed to update usage stats: ${error}`);
    }
  }

  async deleteUserData(userId: string): Promise<void> {
    await this.initialize();

    try {
      // First, count how many records we're about to delete
      const scrollResult = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'userId', match: { value: userId } }
          ]
        },
        limit: 1,
        with_payload: false,
        with_vector: false
      });
      
      console.log(`[VectorStore] Found ${scrollResult.points.length} records for user ${userId} to delete`);
      
      // Delete using the filter
      await this.client.delete(this.collectionName, {
        filter: {
          must: [
            { key: 'userId', match: { value: userId } }
          ]
        },
        wait: true // Wait for the operation to complete
      });
      
      console.log(`[VectorStore] Delete operation completed for user ${userId}`);
      
      // Verify deletion
      const verifyResult = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            { key: 'userId', match: { value: userId } }
          ]
        },
        limit: 1,
        with_payload: false,
        with_vector: false
      });
      
      if (verifyResult.points.length > 0) {
        console.warn(`[VectorStore] Warning: ${verifyResult.points.length} records still remain for user ${userId}`);
      }
      
    } catch (error) {
      throw new Error(`Failed to delete user data: ${error}`);
    }
  }

  async getCollectionInfo() {
    await this.initialize();
    
    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        name: this.collectionName,
        vectorCount: info.points_count || 0,
        indexedVectorsCount: info.indexed_vectors_count || 0,
        status: info.status,
        config: info.config,
        vectorsCount: info.vectors_count,
        pointsCount: info.points_count
      };
    } catch (error) {
      throw new Error(`Failed to get collection info: ${error}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const vectorStore = new VectorStore();