import { setupVectorMocks } from './__mocks__/setup-vector-mocks';

// Get dynamic mocks
const { mockQdrantClient } = setupVectorMocks();

// Mock external dependencies first (before imports)
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn().mockImplementation(async () => {
    // Return a function that generates embeddings
    return jest.fn().mockImplementation(async (text: string) => ({
      data: new Float32Array(384).fill(0.1), // 384-dimensional vector
      shape: [1, 384]
    }));
  })
}));

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => mockQdrantClient)
}));

import { VectorStore } from '../vector/qdrant-client';
import { EmbeddingService } from '../vector/embedding-service';
import { UsageTracker } from '../vector/usage-tracker';
import dotenv from 'dotenv';

dotenv.config();

describe('Vector Services Integration', () => {
  let vectorStore: VectorStore;
  let embeddingService: EmbeddingService;
  let usageTracker: UsageTracker;
  const integrationUserId = `integration-test-${Date.now()}`;
  
  beforeAll(async () => {
    vectorStore = new VectorStore();
    embeddingService = new EmbeddingService();
    usageTracker = new UsageTracker(vectorStore);
    
    await Promise.all([
      vectorStore.initialize(),
      embeddingService.initialize()
    ]);
  }, 30000);
  
  afterAll(async () => {
    await vectorStore.deleteUserData(integrationUserId);
  });
  
  describe('End-to-end email processing', () => {
    it('should process and retrieve emails with relationship context', async () => {
      // Simulate processing emails from different relationships
      const emailScenarios = [
        {
          text: 'Hey honey, don\'t forget to pick up milk on your way home. Love you!',
          relationship: 'spouse',
          recipient: 'sarah@gmail.com'
        },
        {
          text: 'Hi team, attached is the Q4 report. Please review before tomorrow\'s meeting.',
          relationship: 'colleagues',
          recipient: 'team@company.com'
        },
        {
          text: 'Dear Dr. Smith, I need to reschedule my appointment. What times work for you?',
          relationship: 'external',
          recipient: 'doctor@clinic.com'
        }
      ];
      
      // Process and store emails
      for (const scenario of emailScenarios) {
        const { vector } = await embeddingService.embedText(scenario.text);
        
        await vectorStore.upsertEmail({
          id: `${integrationUserId}-${scenario.relationship}-${Date.now()}`,
          userId: integrationUserId,
          vector,
          metadata: {
            emailId: `email-${Date.now()}`,
            userId: integrationUserId,
            extractedText: scenario.text,
            recipientEmail: scenario.recipient,
            subject: 'Test subject',
            sentDate: new Date().toISOString(),
            features: {
              sentiment: { score: 0.8, dominant: 'positive' },
              stats: { wordCount: scenario.text.split(' ').length, formalityScore: 0.5 }
            },
            relationship: {
              type: scenario.relationship,
              confidence: 0.9,
              detectionMethod: 'test'
            },
            frequencyScore: 1,
            wordCount: scenario.text.split(' ').length
          }
        });
      }
      
      // Test relationship-aware retrieval
      const spouseQuery = 'I love you too, see you tonight';
      const { vector: spouseVector } = await embeddingService.embedText(spouseQuery);
      
      const spouseResults = await vectorStore.searchSimilar({
        userId: integrationUserId,
        queryVector: spouseVector,
        relationship: 'spouse',
        limit: 5
      });
      
      expect(spouseResults.length).toBeGreaterThan(0);
      expect(spouseResults[0].metadata.relationship.type).toBe('spouse');
      expect(spouseResults[0].score).toBeGreaterThan(0.5);
    });
  });
  
  describe('Continuous learning workflow', () => {
    it('should track usage and update effectiveness', async () => {
      // Step 1: Store some example emails
      const exampleTexts = [
        'Thanks for your help with the project!',
        'I appreciate your assistance on this matter.',
        'Great work on the presentation today.'
      ];
      
      const exampleIds: string[] = [];
      
      for (const [idx, text] of exampleTexts.entries()) {
        const { vector } = await embeddingService.embedText(text);
        const id = `${integrationUserId}-learning-${idx}`;
        
        await vectorStore.upsertEmail({
          id,
          userId: integrationUserId,
          vector,
          metadata: {
            emailId: id,
            userId: integrationUserId,
            extractedText: text,
            recipientEmail: 'colleague@work.com',
            subject: 'Appreciation',
            sentDate: new Date().toISOString(),
            features: {
              sentiment: { score: 0.9, dominant: 'positive' },
              stats: { wordCount: text.split(' ').length, formalityScore: 0.6 }
            },
            relationship: {
              type: 'colleagues',
              confidence: 0.95,
              detectionMethod: 'test'
            },
            frequencyScore: 1,
            wordCount: text.split(' ').length
          }
        });
        
        exampleIds.push(id);
      }
      
      // Step 2: Simulate draft generation using these examples
      const draftId = `draft-${Date.now()}`;
      await usageTracker.trackExampleUsage(draftId, exampleIds);
      
      // Step 3: Simulate user feedback
      await usageTracker.trackExampleFeedback({
        draftId,
        exampleIds: exampleIds.slice(0, 2), // Only first two were good
        feedback: {
          edited: true,
          editDistance: 0.1, // Minor edits
          accepted: true,
          userRating: 0.9
        }
      });
      
      // Step 4: Update stats for the examples that weren't as useful
      await vectorStore.updateUsageStats([{
        vectorId: exampleIds[2],
        wasUsed: true,
        wasEdited: true,
        editDistance: 0.4, // Major edits
        userRating: 0.3
      }]);
      
      // Verify the system can still retrieve and use examples
      const query = 'Thank you for helping';
      const { vector: queryVector } = await embeddingService.embedText(query);
      
      const results = await vectorStore.searchSimilar({
        userId: integrationUserId,
        queryVector,
        relationship: 'colleagues',
        limit: 3
      });
      
      expect(results.length).toBeGreaterThan(0);
    });
  });
  
  describe('Performance and scale', () => {
    it('should handle batch operations efficiently', async () => {
      const batchSize = 50;
      const texts = Array(batchSize).fill(null).map((_, i) => 
        `Batch test email ${i}: This is a test of batch processing performance.`
      );
      
      // Batch embed
      const startEmbed = Date.now();
      const embedResult = await embeddingService.embedBatch(texts, {
        batchSize: 10
      });
      const embedDuration = Date.now() - startEmbed;
      
      expect(embedResult.embeddings).toHaveLength(batchSize);
      expect(embedResult.errors).toHaveLength(0);
      console.log(`Embedded ${batchSize} texts in ${embedDuration}ms`);
      
      // Batch upsert
      const emails = embedResult.embeddings.map((embedding, idx) => ({
        id: `${integrationUserId}-perf-${idx}`,
        userId: integrationUserId,
        vector: embedding.vector,
        metadata: {
          emailId: `perf-${idx}`,
          userId: integrationUserId,
          extractedText: texts[idx],
          recipientEmail: 'test@example.com',
          subject: 'Performance test',
          sentDate: new Date().toISOString(),
          features: {
            sentiment: { score: 0.5, dominant: 'neutral' },
            stats: { wordCount: 10, formalityScore: 0.5 }
          },
          relationship: {
            type: 'colleagues',
            confidence: 0.9,
            detectionMethod: 'test'
          },
          frequencyScore: 1,
          wordCount: 10
        }
      }));
      
      const startUpsert = Date.now();
      await vectorStore.upsertBatch(emails);
      const upsertDuration = Date.now() - startUpsert;
      
      console.log(`Upserted ${batchSize} vectors in ${upsertDuration}ms`);
      
      // Verify retrieval performance
      const queryText = 'batch test email 25';
      const { vector: queryVector } = await embeddingService.embedText(queryText);
      
      const startSearch = Date.now();
      const searchResults = await vectorStore.searchSimilar({
        userId: integrationUserId,
        queryVector,
        limit: 10
      });
      const searchDuration = Date.now() - startSearch;
      
      console.log(`Searched ${batchSize} vectors in ${searchDuration}ms`);
      expect(searchResults.length).toBeGreaterThan(0);
      
      // Performance assertions
      expect(embedDuration).toBeLessThan(10000); // 10 seconds for 50 embeddings
      expect(upsertDuration).toBeLessThan(5000); // 5 seconds for batch upsert
      expect(searchDuration).toBeLessThan(1000); // 1 second for search
    });
  });
  
  describe('Edge cases and error recovery', () => {
    it('should handle near-duplicate emails correctly', async () => {
      const originalText = 'Meeting tomorrow at 3pm in conference room A';
      const slightVariation = 'Meeting tomorrow at 3 PM in conference room A'; // Minor formatting
      
      const { vector: originalVector } = await embeddingService.embedText(originalText);
      const { vector: variationVector } = await embeddingService.embedText(slightVariation);
      
      // Store original
      await vectorStore.upsertEmail({
        id: `${integrationUserId}-dup-original`,
        userId: integrationUserId,
        vector: originalVector,
        metadata: {
          emailId: 'dup-original',
          userId: integrationUserId,
          extractedText: originalText,
          recipientEmail: 'team@company.com',
          subject: 'Meeting',
          sentDate: new Date().toISOString(),
          features: {
            sentiment: { score: 0.5, dominant: 'neutral' },
            stats: { wordCount: 8, formalityScore: 0.5 }
          },
          relationship: {
            type: 'colleagues',
            confidence: 0.9,
            detectionMethod: 'test'
          },
          frequencyScore: 1,
          wordCount: 8
        }
      });
      
      // Check for near-duplicates
      const duplicates = await vectorStore.findNearDuplicates(
        integrationUserId,
        variationVector,
        0.95
      );
      
      expect(duplicates.length).toBeGreaterThan(0);
      expect(duplicates[0].score).toBeGreaterThan(0.95);
    });
    
    it('should maintain data integrity across operations', async () => {
      // Get initial stats
      const initialStats = await vectorStore.getRelationshipStats(integrationUserId);
      const initialCount = Object.values(initialStats).reduce((a, b) => a + b, 0);
      
      // Add an email
      const text = 'Data integrity test email';
      const { vector } = await embeddingService.embedText(text);
      
      await vectorStore.upsertEmail({
        id: `${integrationUserId}-integrity`,
        userId: integrationUserId,
        vector,
        metadata: {
          emailId: 'integrity-test',
          userId: integrationUserId,
          extractedText: text,
          recipientEmail: 'test@example.com',
          subject: 'Test',
          sentDate: new Date().toISOString(),
          features: {
            sentiment: { score: 0.5, dominant: 'neutral' },
            stats: { wordCount: 4, formalityScore: 0.5 }
          },
          relationship: {
            type: 'external',
            confidence: 0.9,
            detectionMethod: 'test'
          },
          frequencyScore: 1,
          wordCount: 4
        }
      });
      
      // Get updated stats
      const updatedStats = await vectorStore.getRelationshipStats(integrationUserId);
      const updatedCount = Object.values(updatedStats).reduce((a, b) => a + b, 0);
      
      expect(updatedCount).toBe(initialCount + 1);
      expect(updatedStats.external).toBe((initialStats.external || 0) + 1);
    });
  });
});