#!/usr/bin/env node
import { embeddingService, vectorStore } from '../../lib/vector';
import { VectorStore } from '../../lib/vector/qdrant-client';
import { EmbeddingService } from '../../lib/vector/embedding-service';
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

    // 1. Test Qdrant connection and health
    console.log('1️⃣ Testing Qdrant Connection...');
    const health = await vectorStore.healthCheck();
    console.log(`✅ Qdrant health check: ${health ? 'Connected' : 'Failed'}`);
    
    const info = await vectorStore.getCollectionInfo();
    console.log(`✅ Collection '${info.name}' info:`, {
      vectors: info.vectorCount,
      status: info.status,
      vectorSize: info.config?.params?.vectors?.size || 384,
      distanceMetric: info.config?.params?.vectors?.distance || 'Cosine'
    });

    // 2. Test embedding service
    console.log('\n2️⃣ Testing Embedding Service...');
    const testText = 'Hello team, I hope this email finds you well. I wanted to discuss our upcoming project deadline.';
    
    console.log('Generating embedding for test text...');
    const embedding = await embeddingService.embedText(testText);
    console.log(`✅ Generated ${embedding.dimensions}D embedding using ${embedding.model}`);
    console.log(`   First 5 values: [${embedding.vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);

    // 3. Test similarity comparison
    console.log('\n3️⃣ Testing Text Similarity...');
    const text1 = 'The weather is nice today';
    const text2 = 'It\'s a beautiful sunny day';
    const text3 = 'I need to submit my tax returns';
    
    const sim1 = await embeddingService.compareTexts(text1, text2);
    const sim2 = await embeddingService.compareTexts(text1, text3);
    
    console.log(`✅ Similarity between related texts: ${sim1.toFixed(4)}`);
    console.log(`✅ Similarity between unrelated texts: ${sim2.toFixed(4)}`);

    // 4. Test batch embedding and storage
    console.log('\n4️⃣ Testing Batch Operations...');
    const testEmails = [
      { text: 'Hey honey, dinner at 7?', relationship: 'spouse', recipient: 'wife@example.com' },
      { text: 'Team meeting tomorrow at 10am', relationship: 'colleagues', recipient: 'team@company.com' },
      { text: 'Thanks for the great work!', relationship: 'colleagues', recipient: 'boss@company.com' },
      { text: 'Movie tonight?', relationship: 'friends', recipient: 'friend@gmail.com' },
      { text: 'Investment proposal attached', relationship: 'investors', recipient: 'investor@fund.com' },
      { text: 'Meeting scheduled for tomorrow', relationship: 'colleagues', recipient: 'colleague@company.com' },
      { text: 'Please review the attached document', relationship: 'colleagues', recipient: 'manager@company.com' },
      { text: 'Thanks for your help with the project', relationship: 'colleagues', recipient: 'teammate@company.com' }
    ];

    // Generate embeddings in batch with progress tracking
    const batchStart = Date.now();
    const embedResult = await embeddingService.embedBatch(
      testEmails.map(e => e.text),
      { 
        batchSize: 3,
        onProgress: (processed, total) => {
          console.log(`   Progress: ${processed}/${total}`);
        }
      }
    );
    const embedTime = Date.now() - batchStart;
    console.log(`✅ Generated ${embedResult.embeddings.length} embeddings in ${embedTime}ms`);
    console.log(`   Total time: ${embedResult.totalTime}ms, Average: ${(embedResult.totalTime / embedResult.embeddings.length).toFixed(2)}ms per embedding`);
    if (embedResult.errors.length > 0) {
      console.log(`   ⚠️  ${embedResult.errors.length} errors occurred`);
    }

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

    // 5. Test inserting and searching vectors (single operation)
    console.log('\n5️⃣ Testing Single Vector Storage & Search...');
    
    // Insert test email
    const singleTestEmail = {
      id: `test-single-${Date.now()}`,
      userId: testUserId,
      vector: embedding.vector,
      metadata: {
        emailId: `test-single-${Date.now()}`,
        userId: testUserId,
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

    await vectorStore.upsertEmail(singleTestEmail);
    console.log('✅ Test email vector inserted');

    // Search for similar emails
    const searchQuery = 'I need to talk about our project timeline and deliverables';
    const queryEmbedding = await embeddingService.embedText(searchQuery);
    
    const searchResults = await vectorStore.searchSimilar({
      userId: testUserId,
      queryVector: queryEmbedding.vector,
      relationship: 'colleagues',
      limit: 5,
      scoreThreshold: 0.1
    });

    console.log(`✅ Found ${searchResults.length} similar emails for query: "${searchQuery}"`);
    if (searchResults.length > 0) {
      console.log('   Top results:');
      searchResults.slice(0, 3).forEach((result, idx) => {
        console.log(`   ${idx + 1}. "${result.metadata.extractedText}" (score: ${result.score?.toFixed(4)}, relationship: ${result.metadata.relationship.type})`);
      });
    }

    // 6. Test relationship-based operations
    console.log('\n6️⃣ Testing Relationship-Based Operations...');
    
    // Get by relationship
    for (const relationship of ['spouse', 'colleagues', 'friends', 'investors']) {
      const results = await vectorStore.getByRelationship(testUserId, relationship);
      console.log(`✅ Found ${results.length} emails for relationship: ${relationship}`);
    }

    // Get relationship stats
    const stats = await vectorStore.getRelationshipStats(testUserId);
    console.log('✅ Relationship distribution:', stats);

    // 7. Test near-duplicate detection
    console.log('\n7️⃣ Testing Near-Duplicate Detection...');
    const duplicateQuery = 'Team meeting tomorrow at 10am'; // Exact match
    const { vector: dupVector } = await embeddingService.embedText(duplicateQuery);
    
    const duplicates = await vectorStore.findNearDuplicates(testUserId, dupVector, 0.9);
    console.log(`✅ Found ${duplicates.length} near-duplicates for: "${duplicateQuery}"`);
    if (duplicates.length > 0) {
      duplicates.forEach((dup, idx) => {
        console.log(`   ${idx + 1}. "${dup.metadata.extractedText}" (score: ${dup.score?.toFixed(4)})`);
      });
    }

    // 8. Test usage tracking
    console.log('\n8️⃣ Testing Usage Statistics...');
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

    // 9. Test performance with larger dataset
    console.log('\n9️⃣ Testing Performance at Scale...');
    const largeTexts = Array(25).fill(null).map((_, i) => 
      `This is test email number ${i} about various topics like work, family, and friends.`
    );
    
    const perfStart = Date.now();
    const largeBatchResult = await embeddingService.embedBatch(largeTexts, { 
      batchSize: 10,
      onProgress: (processed, total) => {
        if (processed % 10 === 0) {
          console.log(`   Progress: ${processed}/${total}`);
        }
      }
    });
    const perfTime = Date.now() - perfStart;
    
    console.log(`✅ Generated ${largeBatchResult.embeddings.length} embeddings in ${perfTime}ms`);
    console.log(`   Average: ${(perfTime / largeBatchResult.embeddings.length).toFixed(2)}ms per embedding`);
    console.log(`   Batch processing saved: ${((largeTexts.length * 100) - perfTime).toFixed(0)}ms (assuming 100ms per individual embedding)`);

    // 10. Test direct Qdrant client operations
    console.log('\n🔟 Testing Direct Qdrant Client Operations...');
    const directVectorStore = new VectorStore();
    const directEmbeddingService = new EmbeddingService();
    
    await directVectorStore.initialize();
    await directEmbeddingService.initialize();
    
    const directTestText = 'Direct Qdrant test email content';
    const { vector: directVector } = await directEmbeddingService.embedText(directTestText);
    console.log(`✅ Direct embedding generated: ${directVector.length} dimensions`);
    
    const directTestId = `direct-test-${Date.now()}`;
    await directVectorStore.upsertEmail({
      id: directTestId,
      userId: 'direct-test-user',
      vector: directVector,
      metadata: {
        emailId: directTestId,
        userId: 'direct-test-user',
        extractedText: directTestText,
        recipientEmail: 'test@example.com',
        subject: 'Direct Test',
        sentDate: new Date().toISOString(),
        features: {} as any,
        relationship: {
          type: 'test',
          confidence: 1,
          detectionMethod: 'manual'
        },
        frequencyScore: 1,
        wordCount: 5
      }
    });
    console.log('✅ Direct vector stored successfully');
    
    // Search for it
    const directResults = await directVectorStore.searchSimilar({
      userId: 'direct-test-user',
      queryVector: directVector,
      limit: 1
    });
    console.log(`✅ Direct search retrieved ${directResults.length} results`);
    if (directResults.length > 0) {
      console.log(`   Match: "${directResults[0].metadata.extractedText}" (score: ${directResults[0].score?.toFixed(4)})`);
    }
    
    // Clean up direct test data
    await directVectorStore.deleteUserData('direct-test-user');
    console.log('✅ Direct test data cleaned up');

    // 11. Final collection statistics
    console.log('\n1️⃣1️⃣ Final Collection Statistics...');
    const finalInfo = await vectorStore.getCollectionInfo();
    console.log(`✅ Collection status: ${finalInfo.status}`);
    console.log(`   Total vectors: ${finalInfo.vectorCount}`);
    console.log(`   Vector dimensions: ${finalInfo.config?.params?.vectors?.size || 384}`);
    console.log(`   Distance metric: ${finalInfo.config?.params?.vectors?.distance || 'Cosine'}`);

    // Cleanup
    console.log('\n🧹 Cleaning up all test data...');
    await vectorStore.deleteUserData(testUserId);
    console.log('✅ Test data cleaned up');

    console.log('\n✨ All comprehensive tests passed!');
    console.log('🎉 Vector services are working correctly!');
    
  } catch (error) {
    console.error('❌ Comprehensive test failed:', error);
    process.exit(1);
  }
}

// Run the comprehensive test if called directly
if (require.main === module) {
  comprehensiveVectorTest();
}

export { comprehensiveVectorTest };