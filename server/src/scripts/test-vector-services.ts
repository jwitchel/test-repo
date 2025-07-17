import { embeddingService, vectorStore } from '../lib/vector';
import dotenv from 'dotenv';

dotenv.config();

async function testVectorServices() {
  console.log('🚀 Testing Vector Services\n');

  try {
    // 1. Test embedding service
    console.log('1️⃣ Testing Embedding Service...');
    const testText = 'Hello team, I hope this email finds you well. I wanted to discuss our upcoming project deadline.';
    
    console.log('Generating embedding for test text...');
    const embedding = await embeddingService.embedText(testText);
    console.log(`✅ Generated ${embedding.dimensions}D embedding using ${embedding.model}`);
    console.log(`   First 5 values: [${embedding.vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);

    // 2. Test similarity comparison
    console.log('\n2️⃣ Testing Text Similarity...');
    const text1 = 'The weather is nice today';
    const text2 = 'It\'s a beautiful sunny day';
    const text3 = 'I need to submit my tax returns';
    
    const sim1 = await embeddingService.compareTexts(text1, text2);
    const sim2 = await embeddingService.compareTexts(text1, text3);
    
    console.log(`✅ Similarity between related texts: ${sim1.toFixed(4)}`);
    console.log(`✅ Similarity between unrelated texts: ${sim2.toFixed(4)}`);

    // 3. Test Qdrant connection
    console.log('\n3️⃣ Testing Qdrant Connection...');
    await vectorStore.initialize();
    
    const health = await vectorStore.healthCheck();
    console.log(`✅ Qdrant health check: ${health ? 'Connected' : 'Failed'}`);
    
    const info = await vectorStore.getCollectionInfo();
    console.log(`✅ Collection '${info.name}' info:`, {
      vectors: info.vectorCount,
      status: info.status
    });

    // 4. Test inserting and searching vectors
    console.log('\n4️⃣ Testing Vector Storage & Search...');
    
    // Insert test email
    const testEmail = {
      id: `test-${Date.now()}`,
      userId: 'test-user',
      vector: embedding.vector,
      metadata: {
        emailId: `test-${Date.now()}`,
        userId: 'test-user',
        extractedText: testText,
        recipientEmail: 'colleague@company.com',
        subject: 'Project deadline discussion',
        sentDate: new Date().toISOString(),
        features: {
          sentiment: { score: 0.8, dominant: 'positive' },
          stats: { wordCount: 15, formalityScore: 0.7 }
        },
        relationship: {
          type: 'colleagues',
          confidence: 0.9,
          detectionMethod: 'rule-based'
        },
        frequencyScore: 1,
        wordCount: 15
      }
    };

    await vectorStore.upsertEmail(testEmail);
    console.log('✅ Test email vector inserted');

    // Search for similar emails
    const searchQuery = 'I need to talk about our project timeline and deliverables';
    const queryEmbedding = await embeddingService.embedText(searchQuery);
    
    const searchResults = await vectorStore.searchSimilar({
      userId: 'test-user',
      queryVector: queryEmbedding.vector,
      relationship: 'colleagues',
      limit: 5
    });

    console.log(`✅ Found ${searchResults.length} similar emails`);
    if (searchResults.length > 0) {
      console.log('   Top result:', {
        score: searchResults[0].score?.toFixed(4),
        subject: searchResults[0].metadata.subject,
        relationship: searchResults[0].metadata.relationship.type
      });
    }

    // 5. Test relationship filtering
    console.log('\n5️⃣ Testing Relationship-based Search...');
    const stats = await vectorStore.getRelationshipStats('test-user');
    console.log('✅ Relationship distribution:', stats);

    // 6. Test batch operations
    console.log('\n6️⃣ Testing Batch Embeddings...');
    const batchTexts = [
      'Meeting scheduled for tomorrow',
      'Please review the attached document',
      'Thanks for your help with the project'
    ];
    
    const batchResults = await embeddingService.embedBatch(batchTexts, {
      batchSize: 2,
      onProgress: (processed, total) => {
        console.log(`   Progress: ${processed}/${total}`);
      }
    });
    
    console.log(`✅ Batch embedding complete: ${batchResults.embeddings.length} succeeded, ${batchResults.errors.length} failed`);
    console.log(`   Total time: ${batchResults.totalTime}ms`);

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await vectorStore.deleteUserData('test-user');
    console.log('✅ Test data cleaned up');

    console.log('\n✨ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testVectorServices();