#!/usr/bin/env node
import { VectorStore } from '../vector/qdrant-client';
import { EmbeddingService } from '../vector/embedding-service';
import { RelationshipDetector } from '../relationships/relationship-detector';
import { RelationshipService } from '../relationships/relationship-service';
import { ExampleSelector } from './example-selector';
import { EmailIngestPipeline, ProcessedEmail } from './email-ingest-pipeline';

async function testPipeline() {
  console.log('🚀 Testing Pipeline Components\n');

  // Initialize services
  const vectorStore = new VectorStore();
  const embeddingService = new EmbeddingService();
  const relationshipDetector = new RelationshipDetector();
  const relationshipService = new RelationshipService();

  try {
    // Initialize all services
    console.log('1️⃣ Initializing services...');
    await Promise.all([
      vectorStore.initialize(),
      embeddingService.initialize(),
      relationshipDetector.initialize(),
      relationshipService.initialize()
    ]);
    console.log('✅ Services initialized\n');

    // Test 1: Email Ingestion Pipeline
    console.log('2️⃣ Testing Email Ingestion Pipeline...');
    const ingestPipeline = new EmailIngestPipeline(
      vectorStore,
      embeddingService,
      relationshipDetector,
      {
        batchSize: 5,
        parallelism: 2,
        errorThreshold: 0.2
      }
    );

    // Create sample emails
    const sampleEmails: ProcessedEmail[] = [
      {
        messageId: 'test-1',
        to: ['wife@gmail.com'],
        toName: 'Sarah',
        subject: 'Re: Dinner tonight?',
        date: new Date().toISOString(),
        extractedText: "Hey honey! I'll be home by 7pm. Love you!",
        responseTime: 30
      },
      {
        messageId: 'test-2',
        to: ['mike@techcorp.com'],
        toName: 'Mike Johnson',
        subject: 'Re: Project update',
        date: new Date().toISOString(),
        extractedText: "Hi Mike, I've reviewed the proposal and it looks good. Let's schedule a meeting to discuss next steps.",
        responseTime: 120
      },
      {
        messageId: 'test-3',
        to: ['alex@gmail.com'],
        toName: 'Alex',
        subject: 'Re: Weekend plans',
        date: new Date().toISOString(),
        extractedText: "Hey dude! Yeah, I'm totally up for hiking on Saturday. What time works for you?",
        responseTime: 45
      }
    ];

    // Process the emails
    const result = await ingestPipeline.processHistoricalEmails('test-user', 'test-account', sampleEmails);
    console.log('✅ Ingestion complete:', result);
    console.log(`   - Processed: ${result.processed} emails`);
    console.log(`   - Errors: ${result.errors}`);
    console.log(`   - Relationships:`, result.relationshipDistribution);
    console.log('');

    // Test 2: Example Selection
    console.log('3️⃣ Testing Example Selection...');
    const exampleSelector = new ExampleSelector(
      vectorStore,
      embeddingService,
      relationshipService,
      relationshipDetector
    );

    // Test selecting examples for a new email
    const incomingEmail = "When are you coming home tonight?";
    const recipientEmail = "wife@gmail.com";

    console.log(`   Incoming: "${incomingEmail}"`);
    console.log(`   To: ${recipientEmail}`);

    const examples = await exampleSelector.selectExamples({
      userId: 'test-user',
      incomingEmail,
      recipientEmail,
      desiredCount: 10
    });

    console.log('✅ Example selection complete:');
    console.log(`   - Detected relationship: ${examples.relationship}`);
    console.log(`   - Total candidates: ${examples.stats.totalCandidates}`);
    console.log(`   - Relationship matches: ${examples.stats.relationshipMatch}`);
    console.log(`   - Diversity score: ${examples.stats.diversityScore.toFixed(2)}`);
    console.log(`   - Selected ${examples.examples.length} examples:`);
    
    examples.examples.forEach((ex, i) => {
      console.log(`     ${i + 1}. "${ex.text.substring(0, 50)}..." (score: ${ex.score.toFixed(3)})`);
    });

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testPipeline().catch(console.error);
}

export { testPipeline };