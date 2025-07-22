#!/usr/bin/env node
import { relationshipService } from '../lib/relationships/relationship-service';
import { styleAggregationService } from '../lib/style/style-aggregation-service';
import { VectorStore } from '../lib/vector/qdrant-client';
import { Pool } from 'pg';
import chalk from 'chalk';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb',
});

async function testAggregatedStyleIntegration() {
  console.log(chalk.bold('🧪 Testing Aggregated Style Integration\n'));
  
  const testUserId = 'test-aggregated-style-user';
  const testRelationshipType = 'colleague';
  
  try {
    // Initialize services
    const vectorStore = new VectorStore();
    await vectorStore.initialize();
    await relationshipService.initialize();
    
    // Ensure test user exists
    await pool.query(
      `INSERT INTO "user" (id, email, name, "createdAt", "updatedAt") 
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [testUserId, 'test-aggregated@example.com', 'Test Aggregated User']
    );
    
    // Create user_relationships entry to satisfy FK constraint
    await pool.query(
      `INSERT INTO user_relationships (user_id, relationship_type, display_name, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (user_id, relationship_type) DO NOTHING`,
      [testUserId, testRelationshipType, 'Colleagues']
    );
    
    console.log(chalk.blue('1️⃣ Testing style preferences retrieval...'));
    const stylePrefs = await relationshipService.getStylePreferences(testUserId, testRelationshipType);
    console.log('Style preferences:', stylePrefs);
    
    console.log(chalk.blue('\n2️⃣ Testing aggregated style retrieval...'));
    const aggregatedStyle = await relationshipService.getAggregatedStyle(testUserId, testRelationshipType);
    console.log('Aggregated style:', aggregatedStyle ? 'Found' : 'Not found');
    
    if (!aggregatedStyle) {
      console.log(chalk.yellow('No aggregated style found. Creating test data...'));
      
      // Create some test aggregated style
      const testAggregated = {
        greetings: [
          { text: 'Hi Sarah,', frequency: 10, percentage: 40 },
          { text: 'Hey Sarah,', frequency: 8, percentage: 32 },
          { text: 'Good morning Sarah,', frequency: 7, percentage: 28 }
        ],
        closings: [
          { text: 'Best,', frequency: 15, percentage: 60 },
          { text: 'Thanks,', frequency: 10, percentage: 40 }
        ],
        emojis: [
          { emoji: '👍', frequency: 5, contexts: ['positive'] },
          { emoji: '😊', frequency: 3, contexts: ['positive', 'neutral'] }
        ],
        contractions: {
          uses: true,
          frequency: 20,
          examples: ["I'll", "don't", "can't", "won't"]
        },
        sentimentProfile: {
          primaryTone: 'warm',
          averageWarmth: 0.7,
          averageFormality: 0.4
        },
        vocabularyProfile: {
          complexityLevel: 'moderate',
          technicalTerms: ['API', 'deployment', 'sprint'],
          commonPhrases: [
            { phrase: 'let me know', frequency: 8 },
            { phrase: 'thanks for', frequency: 6 },
            { phrase: 'looking forward', frequency: 5 }
          ]
        },
        structuralPatterns: {
          averageEmailLength: 85,
          averageSentenceLength: 12,
          paragraphingStyle: 'single'
        },
        emailCount: 25,
        lastUpdated: new Date().toISOString(),
        confidenceScore: 0.6
      };
      
      await styleAggregationService.updateStylePreferences(
        testUserId,
        testRelationshipType,
        testAggregated
      );
      console.log(chalk.green('✅ Test aggregated style created'));
    }
    
    console.log(chalk.blue('\n3️⃣ Testing style preferences conversion...'));
    const convertedPrefs = await relationshipService.getStylePreferences(testUserId, testRelationshipType);
    console.log('Converted preferences:');
    console.log(JSON.stringify(convertedPrefs, null, 2));
    
    console.log(chalk.blue('\n4️⃣ Testing prompt formatting...'));
    const basicPrompt = relationshipService.formatStylePreferencesForPrompt(convertedPrefs!);
    console.log('Basic prompt instructions:');
    console.log(chalk.gray(basicPrompt));
    
    console.log(chalk.blue('\n5️⃣ Testing aggregated prompt formatting...'));
    const aggregatedPrompt = await relationshipService.formatAggregatedStyleForPrompt(testUserId, testRelationshipType);
    console.log('Aggregated prompt instructions:');
    console.log(chalk.gray(aggregatedPrompt));
    
    console.log(chalk.green('\n✅ All tests completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the test
if (require.main === module) {
  testAggregatedStyleIntegration();
}