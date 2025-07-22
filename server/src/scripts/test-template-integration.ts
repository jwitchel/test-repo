#!/usr/bin/env node
import { ToneLearningOrchestrator } from '../lib/pipeline/tone-learning-orchestrator';
import { ProcessedEmail } from '../lib/pipeline/types';
import { Pool } from 'pg';
import { personService } from '../lib/relationships/person-service';
import { styleAggregationService } from '../lib/style/style-aggregation-service';
import chalk from 'chalk';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb',
});

async function testTemplateIntegration() {
  console.log(chalk.bold('🧪 Testing Template Integration with Aggregated Styles\n'));
  
  const testUserId = 'test-template-user';
  const testEmail = 'sarah@company.com';
  const testRelationshipType = 'colleague';
  
  try {
    // Setup test data
    console.log(chalk.blue('Setting up test data...'));
    
    // Create test user
    await pool.query(
      `INSERT INTO "user" (id, email, name, "createdAt", "updatedAt") 
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [testUserId, 'test-template@example.com', 'Test Template User']
    );
    
    // Create user_relationships entry
    await pool.query(
      `INSERT INTO user_relationships (user_id, relationship_type, display_name, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (user_id, relationship_type) DO NOTHING`,
      [testUserId, testRelationshipType, 'Colleagues']
    );
    
    // Create person
    await personService.createPerson({
      userId: testUserId,
      name: 'Sarah',
      emailAddress: testEmail,
      relationshipType: testRelationshipType,
      confidence: 1.0
    });
    
    // Create aggregated style data
    const aggregatedStyle = {
      greetings: [
        { text: 'Hi Sarah,', frequency: 15, percentage: 50 },
        { text: 'Hey Sarah,', frequency: 9, percentage: 30 },
        { text: 'Good morning Sarah,', frequency: 6, percentage: 20 }
      ],
      closings: [
        { text: 'Best,', frequency: 20, percentage: 67 },
        { text: 'Thanks,', frequency: 10, percentage: 33 }
      ],
      emojis: [
        { emoji: '👍', frequency: 8, contexts: ['positive', 'confirmation'] },
        { emoji: '😊', frequency: 5, contexts: ['positive', 'greeting'] },
        { emoji: '✅', frequency: 4, contexts: ['confirmation'] }
      ],
      contractions: {
        uses: true,
        frequency: 25,
        examples: ["I'll", "don't", "can't", "won't", "let's"]
      },
      sentimentProfile: {
        primaryTone: 'warm',
        averageWarmth: 0.72,
        averageFormality: 0.45
      },
      vocabularyProfile: {
        complexityLevel: 'moderate',
        technicalTerms: ['API', 'deployment', 'sprint', 'PR'],
        commonPhrases: [
          { phrase: 'let me know', frequency: 12 },
          { phrase: 'thanks for', frequency: 10 },
          { phrase: 'looking forward', frequency: 8 },
          { phrase: 'quick question', frequency: 6 },
          { phrase: 'makes sense', frequency: 5 }
        ]
      },
      structuralPatterns: {
        averageEmailLength: 95,
        averageSentenceLength: 14.5,
        paragraphingStyle: 'single'
      },
      emailCount: 30,
      lastUpdated: new Date().toISOString(),
      confidenceScore: 0.7
    };
    
    await styleAggregationService.updateStylePreferences(
      testUserId,
      testRelationshipType,
      aggregatedStyle
    );
    
    // Initialize orchestrator
    console.log(chalk.blue('\nInitializing ToneLearningOrchestrator...'));
    const orchestrator = new ToneLearningOrchestrator();
    await orchestrator.initialize();
    
    // Create test incoming email
    const incomingEmail: ProcessedEmail = {
      uid: 'test-incoming-1',
      messageId: '<test@example.com>',
      inReplyTo: null,
      date: new Date(),
      from: [{ address: 'sarah@company.com', name: 'Sarah' }],
      to: [{ address: 'test-template@example.com', name: 'Test User' }],
      cc: [],
      bcc: [],
      subject: 'Quick question about the API changes',
      textContent: 'Hey! Just wanted to check if you had a chance to review the API changes I proposed yesterday. Let me know your thoughts when you get a chance. Thanks!',
      htmlContent: null,
      extractedText: 'Hey! Just wanted to check if you had a chance to review the API changes I proposed yesterday. Let me know your thoughts when you get a chance. Thanks!',
      relationship: {
        type: testRelationshipType,
        confidence: 0.95,
        detectionMethod: 'test'
      }
    };
    
    // Generate draft with verbose output
    console.log(chalk.blue('\nGenerating draft reply...'));
    const draft = await orchestrator.generateDraft({
      incomingEmail,
      recipientEmail: testEmail,
      config: {
        userId: testUserId,
        maxExamples: 5,
        templateName: 'default',
        verbose: true
      }
    });
    
    console.log(chalk.green('\n✅ Template integration test completed successfully!'));
    console.log(chalk.gray('\nDraft metadata:'));
    console.log(JSON.stringify(draft.metadata, null, 2));
    
    // Clean up
    await pool.query(`DELETE FROM people WHERE user_id = $1`, [testUserId]);
    await pool.query(`DELETE FROM relationship_tone_preferences WHERE user_id = $1`, [testUserId]);
    await pool.query(`DELETE FROM user_relationships WHERE user_id = $1`, [testUserId]);
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [testUserId]);
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the test
if (require.main === module) {
  testTemplateIntegration();
}