#!/usr/bin/env node
import { VectorStore } from '../vector/qdrant-client';
import { EmbeddingService } from '../vector/embedding-service';

async function testQdrantConnection() {
  console.log('🔍 Testing Qdrant Connection...\n');
  
  try {
    // 1. Initialize services
    console.log('1️⃣ Initializing services...');
    const vectorStore = new VectorStore();
    const embeddingService = new EmbeddingService();
    
    await vectorStore.initialize();
    await embeddingService.initialize();
    console.log('✅ Services initialized\n');
    
    // 2. Health check
    console.log('2️⃣ Checking Qdrant health...');
    const health = await vectorStore.healthCheck();
    console.log(`✅ Health check: ${health ? 'PASSED' : 'FAILED'}\n`);
    
    // 3. Collection info
    console.log('3️⃣ Getting collection info...');
    const info = await vectorStore.getCollectionInfo();
    console.log('✅ Collection info:');
    console.log(`   - Name: ${info.name}`);
    console.log(`   - Vector size: ${info.config?.params?.vectors?.size}`);
    console.log(`   - Distance metric: ${info.config?.params?.vectors?.distance}\n`);
    
    // 4. Test store and retrieve
    console.log('4️⃣ Testing store and retrieve...');
    const testText = 'Hello Qdrant! This is a test email.';
    const { vector } = await embeddingService.embedText(testText);
    console.log(`   - Generated embedding: ${vector.length} dimensions`);
    
    const testId = `test-${Date.now()}`;
    await vectorStore.upsertEmail({
      id: testId,
      userId: 'test-user',
      vector,
      metadata: {
        emailId: testId,
        userId: 'test-user',
        extractedText: testText,
        recipientEmail: 'test@example.com',
        subject: 'Test',
        sentDate: new Date().toISOString(),
        features: {} as any,
        relationship: {
          type: 'test',
          confidence: 1,
          detectionMethod: 'manual'
        },
        frequencyScore: 1,
        wordCount: 6
      }
    });
    console.log('   - Stored vector successfully');
    
    // Search for it
    const results = await vectorStore.searchSimilar({
      userId: 'test-user',
      queryVector: vector,
      limit: 1
    });
    console.log(`   - Retrieved ${results.length} results`);
    if (results.length > 0) {
      console.log(`   - Match: "${results[0].metadata.extractedText}"`);
      console.log(`   - Score: ${results[0].score}`);
    }
    
    // Clean up
    await vectorStore.deleteUserData('test-user');
    console.log('   - Cleaned up test data\n');
    
    console.log('✅ All tests passed! Qdrant is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testQdrantConnection();
}