import { embeddingService, vectorStore } from '../lib/vector';
import dotenv from 'dotenv';

dotenv.config();

interface PerformanceMetrics {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
}

function calculatePercentiles(times: number[]): PerformanceMetrics {
  const sorted = times.sort((a, b) => a - b);
  const len = sorted.length;
  
  return {
    p50: sorted[Math.floor(len * 0.5)],
    p95: sorted[Math.floor(len * 0.95)],
    p99: sorted[Math.floor(len * 0.99)],
    avg: times.reduce((a, b) => a + b, 0) / len,
    min: sorted[0],
    max: sorted[len - 1]
  };
}

async function benchmarkVectorPerformance() {
  console.log('🚀 Vector Performance Benchmark\n');

  try {
    // Initialize services
    await Promise.all([
      vectorStore.initialize(),
      embeddingService.initialize()
    ]);

    const testUserId = `benchmark-${Date.now()}`;

    // 1. Benchmark embedding generation
    console.log('1️⃣ Benchmarking Embedding Generation...');
    const embeddingTimes: number[] = [];
    const testTexts = [
      'Hello team, meeting at 3pm',
      'Project deadline next week',
      'Thanks for your help!',
      'Can we reschedule the call?',
      'Please review the document',
      'Love you honey',
      'Investment opportunity attached',
      'Birthday party invitation',
      'Report ready for review',
      'Coffee break?'
    ];

    for (let i = 0; i < 50; i++) {
      const text = testTexts[i % testTexts.length];
      const start = performance.now();
      await embeddingService.embedText(text);
      const end = performance.now();
      embeddingTimes.push(end - start);
    }

    const embeddingMetrics = calculatePercentiles(embeddingTimes);
    console.log('✅ Embedding Performance:');
    console.log(`   p50: ${embeddingMetrics.p50.toFixed(2)}ms`);
    console.log(`   p95: ${embeddingMetrics.p95.toFixed(2)}ms`);
    console.log(`   p99: ${embeddingMetrics.p99.toFixed(2)}ms`);
    console.log(`   avg: ${embeddingMetrics.avg.toFixed(2)}ms`);

    // 2. Setup test data for search benchmarks
    console.log('\n2️⃣ Setting up test data...');
    const testVectors = [];
    
    for (let i = 0; i < 100; i++) {
      const text = `Test email ${i}: ${testTexts[i % testTexts.length]}`;
      const { vector } = await embeddingService.embedText(text);
      
      testVectors.push({
        id: `${testUserId}-${i}`,
        userId: testUserId,
        vector,
        metadata: {
          emailId: `email-${i}`,
          userId: testUserId,
          extractedText: text,
          recipientEmail: 'test@example.com',
          subject: 'Test Email',
          sentDate: new Date().toISOString(),
          features: {
            sentiment: { score: 0.5, dominant: 'neutral' },
            stats: { wordCount: 5, formalityScore: 0.5 }
          },
          relationship: {
            type: ['colleagues', 'friends', 'spouse', 'external'][i % 4],
            confidence: 0.9,
            detectionMethod: 'test'
          },
          frequencyScore: 1,
          wordCount: 5
        }
      });
    }

    // Batch insert test data
    const insertStart = performance.now();
    await vectorStore.upsertBatch(testVectors);
    const insertTime = performance.now() - insertStart;
    console.log(`✅ Inserted 100 vectors in ${insertTime.toFixed(2)}ms`);

    // 3. Benchmark vector search
    console.log('\n3️⃣ Benchmarking Vector Search...');
    const searchTimes: number[] = [];
    
    for (let i = 0; i < 50; i++) {
      const queryText = `Query ${i}: meeting project work`;
      const { vector: queryVector } = await embeddingService.embedText(queryText);
      
      const start = performance.now();
      await vectorStore.searchSimilar({
        userId: testUserId,
        queryVector,
        limit: 10,
        scoreThreshold: 0.1
      });
      const end = performance.now();
      searchTimes.push(end - start);
    }

    const searchMetrics = calculatePercentiles(searchTimes);
    console.log('✅ Search Performance:');
    console.log(`   p50: ${searchMetrics.p50.toFixed(2)}ms`);
    console.log(`   p95: ${searchMetrics.p95.toFixed(2)}ms`);
    console.log(`   p99: ${searchMetrics.p99.toFixed(2)}ms`);
    console.log(`   avg: ${searchMetrics.avg.toFixed(2)}ms`);

    // 4. Benchmark relationship filtering
    console.log('\n4️⃣ Benchmarking Relationship Filtering...');
    const relationshipTimes: number[] = [];
    const relationships = ['colleagues', 'friends', 'spouse', 'external'];
    
    for (let i = 0; i < 40; i++) {
      const relationship = relationships[i % relationships.length];
      
      const start = performance.now();
      await vectorStore.getByRelationship(testUserId, relationship, 20);
      const end = performance.now();
      relationshipTimes.push(end - start);
    }

    const relationshipMetrics = calculatePercentiles(relationshipTimes);
    console.log('✅ Relationship Filtering Performance:');
    console.log(`   p50: ${relationshipMetrics.p50.toFixed(2)}ms`);
    console.log(`   p95: ${relationshipMetrics.p95.toFixed(2)}ms`);
    console.log(`   p99: ${relationshipMetrics.p99.toFixed(2)}ms`);
    console.log(`   avg: ${relationshipMetrics.avg.toFixed(2)}ms`);

    // 5. Performance Summary
    console.log('\n📊 Performance Summary:');
    const overallP95 = Math.max(searchMetrics.p95, relationshipMetrics.p95);
    const requirement = 100; // <100ms p95 requirement
    
    console.log(`   Overall p95: ${overallP95.toFixed(2)}ms`);
    console.log(`   Requirement: <${requirement}ms p95`);
    console.log(`   Status: ${overallP95 < requirement ? '✅ PASS' : '❌ FAIL'}`);

    // Cleanup
    console.log('\n🧹 Cleaning up benchmark data...');
    await vectorStore.deleteUserData(testUserId);
    console.log('✅ Cleanup complete');

    console.log('\n✨ Performance benchmark completed!');
    
    if (overallP95 >= requirement) {
      console.error(`❌ Performance requirement not met: ${overallP95.toFixed(2)}ms >= ${requirement}ms`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Run the benchmark
benchmarkVectorPerformance();