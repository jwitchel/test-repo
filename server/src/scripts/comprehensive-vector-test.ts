import { embeddingService, vectorStore } from '../lib/vector';
import dotenv from 'dotenv';

dotenv.config();

async function comprehensiveVectorTest() {
  console.log('🚀 Comprehensive Vector Test Suite\n');

  try {
    // Initialize services
    await Promise.all([
      vectorStore.initialize(),
      embeddingService.initialize()
    ]);

    const testUserId = `comprehensive-test-${Date.now()}`;
    console.log(`Test User ID: ${testUserId}\n`);

    // 1. Test batch embedding and storage
    console.log('1️⃣ Testing Batch Operations...');
    const testEmails = [
      { text: 'Hey honey, dinner at 7?', relationship: 'spouse', recipient: 'wife@example.com' },
      { text: 'Team meeting tomorrow at 10am', relationship: 'colleagues', recipient: 'team@company.com' },
      { text: 'Thanks for the great work!', relationship: 'colleagues', recipient: 'boss@company.com' },
      { text: 'Movie tonight?', relationship: 'friends', recipient: 'friend@gmail.com' },
      { text: 'Investment proposal attached', relationship: 'investors', recipient: 'investor@fund.com' },
    ];

    // Generate embeddings in batch
    const batchStart = Date.now();
    const embedResult = await embeddingService.embedBatch(
      testEmails.map(e => e.text),
      { batchSize: 3 }
    );
    const embedTime = Date.now() - batchStart;
    console.log(`✅ Generated ${embedResult.embeddings.length} embeddings in ${embedTime}ms`);

    // Prepare vector data
    const vectorData = embedResult.embeddings.map((embedding, idx) => ({
      id: `${testUserId}-email-${idx}`,
      userId: testUserId,
      vector: embedding.vector,
      metadata: {
        emailId: `email-${idx}`,
        userId: testUserId,
        extractedText: testEmails[idx].text,
        recipientEmail: testEmails[idx].recipient,
        subject: 'Test Email',
        sentDate: new Date().toISOString(),
        features: {
          sentiment: { score: 0.8, dominant: 'positive' },
          stats: { wordCount: testEmails[idx].text.split(' ').length, formalityScore: 0.5 }
        },
        relationship: {
          type: testEmails[idx].relationship,
          confidence: 0.9,
          detectionMethod: 'test'
        },
        frequencyScore: 1,
        wordCount: testEmails[idx].text.split(' ').length
      }
    }));

    // Batch upsert
    const upsertStart = Date.now();
    await vectorStore.upsertBatch(vectorData);
    const upsertTime = Date.now() - upsertStart;
    console.log(`✅ Stored ${vectorData.length} vectors in ${upsertTime}ms`);

    // 2. Test relationship-based search
    console.log('\n2️⃣ Testing Relationship-Based Search...');
    for (const relationship of ['spouse', 'colleagues', 'friends', 'investors']) {
      const results = await vectorStore.getByRelationship(testUserId, relationship);
      console.log(`✅ Found ${results.length} emails for relationship: ${relationship}`);
    }

    // 3. Test similarity search
    console.log('\n3️⃣ Testing Similarity Search...');
    const queryText = 'work meeting project';
    const { vector: queryVector } = await embeddingService.embedText(queryText);
    
    const searchResults = await vectorStore.searchSimilar({
      userId: testUserId,
      queryVector,
      limit: 3,
      scoreThreshold: 0.1
    });
    
    console.log(`✅ Found ${searchResults.length} similar emails for query: "${queryText}"`);
    searchResults.forEach((result, idx) => {
      console.log(`   ${idx + 1}. "${result.metadata.extractedText}" (score: ${result.score?.toFixed(3)})`);
    });

    // 4. Test near-duplicate detection
    console.log('\n4️⃣ Testing Near-Duplicate Detection...');
    const duplicateQuery = 'Team meeting tomorrow at 10am'; // Exact match
    const { vector: dupVector } = await embeddingService.embedText(duplicateQuery);
    
    const duplicates = await vectorStore.findNearDuplicates(testUserId, dupVector, 0.9);
    console.log(`✅ Found ${duplicates.length} near-duplicates for: "${duplicateQuery}"`);

    // 5. Test usage tracking
    console.log('\n5️⃣ Testing Usage Statistics...');
    await vectorStore.updateUsageStats([
      {
        vectorId: vectorData[0].id,
        wasUsed: true,
        wasEdited: true,
        editDistance: 0.15,
        userRating: 0.8
      },
      {
        vectorId: vectorData[1].id,
        wasUsed: true,
        wasEdited: false,
        userRating: 1.0
      }
    ]);
    console.log('✅ Updated usage statistics for 2 vectors');

    // 6. Test relationship statistics
    console.log('\n6️⃣ Testing Relationship Statistics...');
    const stats = await vectorStore.getRelationshipStats(testUserId);
    console.log('✅ Relationship distribution:', stats);

    // 7. Test performance with larger dataset
    console.log('\n7️⃣ Testing Performance at Scale...');
    const largeTexts = Array(25).fill(null).map((_, i) => 
      `This is test email number ${i} about various topics like work, family, and friends.`
    );
    
    const perfStart = Date.now();
    const largeBatchResult = await embeddingService.embedBatch(largeTexts, { batchSize: 10 });
    const perfTime = Date.now() - perfStart;
    
    console.log(`✅ Generated ${largeBatchResult.embeddings.length} embeddings in ${perfTime}ms`);
    console.log(`   Average: ${(perfTime / largeBatchResult.embeddings.length).toFixed(2)}ms per embedding`);

    // 8. Test collection info
    console.log('\n8️⃣ Testing Collection Information...');
    const collectionInfo = await vectorStore.getCollectionInfo();
    console.log(`✅ Collection status: ${collectionInfo.status}`);
    console.log(`   Total vectors: ${collectionInfo.vectorCount}`);
    console.log(`   Vector dimensions: ${collectionInfo.config.params.vectors?.size || 384}`);

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await vectorStore.deleteUserData(testUserId);
    console.log('✅ Test data cleaned up');

    console.log('\n✨ All comprehensive tests passed!');
    
  } catch (error) {
    console.error('❌ Comprehensive test failed:', error);
    process.exit(1);
  }
}

// Run the comprehensive test
comprehensiveVectorTest();