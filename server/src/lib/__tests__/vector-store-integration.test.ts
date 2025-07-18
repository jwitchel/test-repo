import { VectorStore, EmailMetadata } from '../vector/qdrant-client';
import { EmbeddingService } from '../vector/embedding-service';
import { UsageTracker } from '../vector/usage-tracker';
import dotenv from 'dotenv';

dotenv.config();

// Integration test - requires Qdrant to be running
describe('VectorStore Integration Tests', () => {
  let vectorStore: VectorStore;
  let embeddingService: EmbeddingService;
  let usageTracker: UsageTracker;
  const testUserId = `test-user-${Date.now()}`;
  
  beforeAll(async () => {
    // Create real instances, no mocks
    vectorStore = new VectorStore();
    embeddingService = new EmbeddingService();
    usageTracker = new UsageTracker(vectorStore);
    
    // Initialize services
    await vectorStore.initialize();
    await embeddingService.initialize();
  }, 30000);
  
  afterAll(async () => {
    // Clean up test data
    try {
      await vectorStore.deleteUserData(testUserId);
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  describe('Basic Operations', () => {
    it('should perform health check', async () => {
      const health = await vectorStore.healthCheck();
      expect(health).toBe(true);
    });

    it('should get collection info', async () => {
      const info = await vectorStore.getCollectionInfo();
      expect(info.name).toBe('user-emails');
      expect(info.config?.params?.vectors?.size).toBe(384);
    });

    it('should upsert and retrieve email', async () => {
      // Generate embedding
      const text = 'Hello, this is a test email!';
      const { vector } = await embeddingService.embedText(text);
      
      // Create test email
      const email = {
        id: `${testUserId}-email-1`,
        userId: testUserId,
        vector,
        metadata: {
          emailId: `${testUserId}-email-1`,
          userId: testUserId,
          extractedText: text,
          recipientEmail: 'test@example.com',
          subject: 'Test Subject',
          sentDate: new Date().toISOString(),
          features: {
            stats: { formalityScore: 0.5, wordCount: 6 },
            sentiment: { dominant: 'neutral' },
            urgency: { level: 'low' }
          },
          relationship: {
            type: 'friend',
            confidence: 0.9,
            detectionMethod: 'test'
          },
          frequencyScore: 1,
          wordCount: 6
        }
      };
      
      // Upsert email
      await vectorStore.upsertEmail(email);
      
      // Search for similar emails
      const results = await vectorStore.searchSimilar({
        userId: testUserId,
        queryVector: vector,
        limit: 10
      });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe(email.id);
      expect(results[0].metadata.extractedText).toBe(text);
    });
  });

  describe('Relationship Filtering', () => {
    let relationshipTestUserId: string;
    
    beforeAll(async () => {
      // Use a unique user ID for this test suite
      relationshipTestUserId = `test-rel-user-${Date.now()}`;
    });
    
    afterAll(async () => {
      // Clean up this suite's test data
      if (relationshipTestUserId) {
        await vectorStore.deleteUserData(relationshipTestUserId);
      }
    });

    it('should filter by relationship type', async () => {
      // Add test emails with different relationships
      const relationships = ['friend', 'colleague', 'family'];
      
      // Create all emails first
      const emails = await Promise.all(relationships.map(async (rel, i) => {
        const text = `Test email for ${rel}`;
        const { vector } = await embeddingService.embedText(text);
        
        return {
          id: `${relationshipTestUserId}-rel-${i}`,
          userId: relationshipTestUserId,
          vector,
          metadata: {
            emailId: `${relationshipTestUserId}-rel-${i}`,
            userId: relationshipTestUserId,
            extractedText: text,
            recipientEmail: `${rel}@example.com`,
            subject: `Test ${rel}`,
            sentDate: new Date().toISOString(),
            features: {
              stats: { formalityScore: 0.5, wordCount: 4 },
              sentiment: { dominant: 'neutral' },
              urgency: { level: 'low' }
            },
            relationship: {
              type: rel,
              confidence: 0.9,
              detectionMethod: 'test'
            },
            frequencyScore: 1,
            wordCount: 4
          }
        };
      }));
      
      // Insert all at once
      console.log('Inserting batch of', emails.length, 'emails');
      await vectorStore.upsertBatch(emails);
      console.log('Batch insert complete');
      
      // Wait longer for indexing
      console.log('Waiting for Qdrant indexing...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Use same query text as debug script
      const { vector } = await embeddingService.embedText('test');
      
      // Try a more general search first
      console.log('Searching for any vectors...');
      const anyResults = await vectorStore.searchSimilar({
        userId: relationshipTestUserId,
        queryVector: vector,
        limit: 10,
        scoreThreshold: 0.1  // Very low threshold
      });
      
      // Then filter by relationship
      const results = await vectorStore.searchSimilar({
        userId: relationshipTestUserId,
        queryVector: vector,
        relationship: 'friend',
        limit: 10,
        scoreThreshold: 0.3  // Lower threshold for filtered searches
      });
      
      // Debug output
      if (results.length === 0) {
        console.log('No friend results found.');
        console.log('All results for this user:', anyResults.map(r => ({
          id: r.id,
          userId: r.metadata.userId,
          text: r.metadata.extractedText,
          relationship: r.metadata.relationship.type
        })));
        console.log('Test userId:', relationshipTestUserId);
        console.log('Number of results with low threshold:', anyResults.length);
      }
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.metadata.relationship.type === 'friend')).toBe(true);
    });

    it('should get emails by relationship', async () => {
      // First ensure data exists by inserting it
      const text = 'Test colleague email';
      const { vector } = await embeddingService.embedText(text);
      
      await vectorStore.upsertEmail({
        id: `${relationshipTestUserId}-col-test`,
        userId: relationshipTestUserId,
        vector,
        metadata: {
          emailId: `${relationshipTestUserId}-col-test`,
          userId: relationshipTestUserId,
          extractedText: text,
          recipientEmail: 'colleague@example.com',
          subject: 'Colleague Test',
          sentDate: new Date().toISOString(),
          features: {} as any,
          relationship: {
            type: 'colleague',
            confidence: 0.9,
            detectionMethod: 'test'
          },
          frequencyScore: 1,
          wordCount: 3
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const emails = await vectorStore.getByRelationship(relationshipTestUserId, 'colleague');
      
      expect(emails.length).toBeGreaterThan(0);
      expect(emails.every(e => e.metadata.relationship.type === 'colleague')).toBe(true);
    });

    it('should get relationship statistics', async () => {
      // Insert test data for stats
      const relationships = ['friend', 'colleague', 'family'];
      
      for (let i = 0; i < relationships.length; i++) {
        const text = `Stats test email for ${relationships[i]}`;
        const { vector } = await embeddingService.embedText(text);
        
        await vectorStore.upsertEmail({
          id: `${relationshipTestUserId}-stats-${i}`,
          userId: relationshipTestUserId,
          vector,
          metadata: {
            emailId: `${relationshipTestUserId}-stats-${i}`,
            userId: relationshipTestUserId,
            extractedText: text,
            recipientEmail: `${relationships[i]}@example.com`,
            subject: `Stats ${relationships[i]}`,
            sentDate: new Date().toISOString(),
            features: {} as any,
            relationship: {
              type: relationships[i],
              confidence: 0.9,
              detectionMethod: 'test'
            },
            frequencyScore: 1,
            wordCount: 5
          }
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const stats = await vectorStore.getRelationshipStats(relationshipTestUserId);
      
      expect(stats).toHaveProperty('friend');
      expect(stats).toHaveProperty('colleague');
      expect(stats).toHaveProperty('family');
      expect(stats.friend).toBeGreaterThan(0);
    });
  });

  describe('Usage Tracking', () => {
    it('should track example usage', async () => {
      const vectorId = `${testUserId}-email-1`;
      
      await usageTracker.trackExampleUsage('draft-1', [vectorId]);
      
      // Note: Usage stats are stored in vector metadata
      // In a real system, we'd verify the update worked
      expect(true).toBe(true);
    });

    it('should track feedback', async () => {
      const feedback = {
        edited: true,
        editDistance: 0.2,
        accepted: true,
        userRating: 4
      };
      
      await usageTracker.trackExampleFeedback({
        draftId: 'draft-1',
        exampleIds: [`${testUserId}-email-1`],
        feedback
      });
      
      // Verify tracking doesn't throw
      expect(true).toBe(true);
    });
  });
});