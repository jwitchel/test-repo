#!/usr/bin/env node
import { EmailIngestPipeline } from './email-ingest-pipeline';
import { ExampleSelector } from './example-selector';
import { PromptFormatter } from './prompt-formatter';
import { extractEmailFeatures, ProcessedEmail } from './types';

// Mock implementations for testing without dependencies
class MockVectorStore {
  private storage: Map<string, any> = new Map();

  async initialize() {
    console.log('   MockVectorStore initialized');
  }

  async upsertEmail(params: any) {
    this.storage.set(params.id, params);
    return { success: true };
  }

  async searchSimilar(params: any) {
    // Return some mock results
    const mockResults = [
      {
        id: 'mock-1',
        score: 0.95,
        metadata: {
          extractedText: "I'll be home by 7pm tonight!",
          relationship: { type: params.relationship },
          features: {
            stats: { formalityScore: 0.2 },
            sentiment: { dominant: 'positive' },
            urgency: { level: 'low' }
          },
          wordCount: 6
        }
      },
      {
        id: 'mock-2',
        score: 0.85,
        metadata: {
          extractedText: "Running late, be there around 8",
          relationship: { type: params.relationship },
          features: {
            stats: { formalityScore: 0.1 },
            sentiment: { dominant: 'neutral' },
            urgency: { level: 'medium' }
          },
          wordCount: 7
        }
      }
    ];
    return mockResults;
  }
}

class MockEmbeddingService {
  async initialize() {
    console.log('   MockEmbeddingService initialized');
  }

  async embedText(text: string) {
    // Return a mock embedding
    return {
      vector: Array(384).fill(0).map(() => Math.random()),
      text
    };
  }
}

async function testPipelineWithMocks() {
  console.log('🧪 Testing Pipeline Components (with mocks)\n');

  // Create mock services
  const mockVectorStore = new MockVectorStore() as any;
  const mockEmbeddingService = new MockEmbeddingService() as any;
  const mockRelationshipDetector = {
    initialize: async () => console.log('   MockRelationshipDetector initialized'),
    detectRelationship: async (params: any) => ({
      relationship: params.recipientEmail.includes('gmail') ? 'friends' : 'colleagues',
      confidence: 0.85,
      method: 'mock'
    })
  } as any;
  const mockRelationshipService = {
    initialize: async () => console.log('   MockRelationshipService initialized'),
    getRelationshipProfile: async () => null
  } as any;

  try {
    // Initialize
    console.log('1️⃣ Initializing mock services...');
    await mockVectorStore.initialize();
    await mockEmbeddingService.initialize();
    await mockRelationshipDetector.initialize();
    await mockRelationshipService.initialize();
    console.log('✅ Mock services initialized\n');

    // Test 1: Email Processing
    console.log('2️⃣ Testing individual email processing...');
    const ingestPipeline = new EmailIngestPipeline(
      mockVectorStore,
      mockEmbeddingService,
      mockRelationshipDetector,
      {
        batchSize: 2,
        parallelism: 1,
        errorThreshold: 0.5
      }
    );

    const testEmail: ProcessedEmail = {
      uid: 'test-uid-1',
      messageId: 'test-email-1',
      inReplyTo: null,
      date: new Date(),
      from: [{ address: 'user@example.com', name: 'Test User' }],
      to: [{ address: 'friend@gmail.com', name: 'John Doe' }],
      cc: [],
      bcc: [],
      subject: 'Re: Lunch tomorrow?',
      textContent: "Sounds great! Let's meet at noon at our usual spot.",
      htmlContent: null,
      extractedText: "Sounds great! Let's meet at noon at our usual spot."
    };

    // Process single email
    const result = await ingestPipeline.processEmail('test-user', testEmail);
    console.log('✅ Email processed:', result);

    // Test feature extraction
    const features = extractEmailFeatures(testEmail.extractedText);
    console.log('   Features extracted:', {
      wordCount: features.stats.wordCount,
      formality: features.stats.formalityScore,
      sentiment: features.sentiment.dominant
    });
    console.log('');

    // Test 2: Batch Processing
    console.log('3️⃣ Testing batch processing...');
    const batchEmails: ProcessedEmail[] = [
      {
        uid: 'batch-uid-1',
        messageId: 'batch-1',
        inReplyTo: null,
        date: new Date(),
        from: [{ address: 'user@example.com', name: 'Test User' }],
        to: [{ address: 'spouse@gmail.com', name: 'Spouse' }],
        cc: [],
        bcc: [],
        subject: 'Re: Groceries',
        textContent: "I'll pick up milk on my way home. Love you!",
        htmlContent: null,
        extractedText: "I'll pick up milk on my way home. Love you!"
      },
      {
        uid: 'batch-uid-2',
        messageId: 'batch-2',
        inReplyTo: null,
        date: new Date(),
        from: [{ address: 'user@example.com', name: 'Test User' }],
        to: [{ address: 'boss@company.com', name: 'Boss' }],
        cc: [],
        bcc: [],
        subject: 'Re: Q3 Report',
        textContent: "I've completed the analysis. The report is attached for your review.",
        htmlContent: null,
        extractedText: "I've completed the analysis. The report is attached for your review."
      }
    ];

    const batchResult = await ingestPipeline.processHistoricalEmails('test-user', 'account-1', batchEmails);
    console.log('✅ Batch processing complete:', batchResult);
    console.log('');

    // Test 3: Example Selection
    console.log('4️⃣ Testing example selection...');
    const exampleSelector = new ExampleSelector(
      mockVectorStore,
      mockEmbeddingService,
      mockRelationshipService,
      mockRelationshipDetector
    );

    const selectionResult = await exampleSelector.selectExamples({
      userId: 'test-user',
      incomingEmail: 'What time will you be home?',
      recipientEmail: 'spouse@gmail.com',
      desiredCount: 5
    });

    console.log('✅ Example selection complete:');
    console.log(`   - Relationship: ${selectionResult.relationship}`);
    console.log(`   - Examples found: ${selectionResult.examples.length}`);
    console.log(`   - Stats:`, selectionResult.stats);
    console.log('');

    // Test 4: Prompt Formatting
    console.log('5️⃣ Testing prompt formatting...');
    const promptFormatter = new PromptFormatter();
    
    const formattedPrompt = promptFormatter.formatWithExamplesStructured({
      incomingEmail: 'What time will you be home?',
      recipientEmail: 'spouse@gmail.com',
      relationship: selectionResult.relationship,
      examples: selectionResult.examples,
      relationshipProfile: {
        typicalFormality: 'very casual',
        commonGreetings: ['Hey', 'Hi honey'],
        commonClosings: ['Love you', 'xoxo'],
        useEmojis: true,
        useHumor: true
      }
    });

    console.log('✅ Prompt formatted:');
    console.log(`   - Example count: ${formattedPrompt.metadata.exampleCount}`);
    console.log(`   - Relationship examples: ${formattedPrompt.metadata.relationshipExampleCount}`);
    console.log(`   - Has profile: ${formattedPrompt.metadata.hasRelationshipProfile}`);
    console.log(`   - Prompt length: ${formattedPrompt.prompt.length} chars`);
    
    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testPipelineWithMocks().catch(console.error);
}

export { testPipelineWithMocks };