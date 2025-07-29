import { ToneLearningOrchestrator } from '../lib/pipeline/tone-learning-orchestrator';
import { ProcessedEmail } from '../lib/pipeline/types';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Create database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb'
});

// Set environment variable to prevent server start
process.env.SKIP_SERVER_START = 'true';

async function testPatternIntegration() {
  console.log(chalk.bold('Testing Writing Pattern Integration...\n'));
  
  const orchestrator = new ToneLearningOrchestrator();
  
  try {
    // Initialize orchestrator
    console.log(chalk.blue('1. Initializing orchestrator...'));
    await orchestrator.initialize();
    console.log(chalk.green('✓ Orchestrator initialized\n'));
    
    // Create test incoming email
    const incomingEmail: ProcessedEmail = {
      uid: 'test-incoming-1',
      messageId: 'incoming@example.com',
      inReplyTo: null,
      date: new Date(),
      from: [{ address: 'colleague@company.com', name: 'Colleague' }],
      to: [{ address: 'me@company.com', name: 'Me' }],
      cc: [],
      bcc: [],
      subject: 'Project Update',
      textContent: 'Hi! Quick question - do you have the latest metrics dashboard ready? The team is asking for an update.',
      htmlContent: null,
      extractedText: 'Hi! Quick question - do you have the latest metrics dashboard ready? The team is asking for an update.'
    };
    
    // Generate draft with pattern analysis
    console.log(chalk.blue('2. Generating draft with pattern analysis...'));
    const result = await orchestrator.generateDraft({
      incomingEmail,
      recipientEmail: 'colleague@company.com',
      config: {
        userId: 'test-user-patterns',
        verbose: true
      }
    });
    
    console.log(chalk.green('\n✓ Draft generated successfully!'));
    console.log(chalk.gray('\nDraft details:'));
    console.log(chalk.gray(`  ID: ${result.id}`));
    console.log(chalk.gray(`  Relationship: ${result.relationship.type} (${(result.relationship.confidence * 100).toFixed(1)}%)`));
    console.log(chalk.gray(`  Examples used: ${result.examplesUsed.length}`));
    console.log(chalk.gray(`  Generated body: "${result.body}"`));
    
    console.log(chalk.green('\n✓ Pattern integration complete!'));
    console.log(chalk.gray('\nNote: To see the actual prompt with patterns, check verbose mode output above.'));
    
  } catch (error) {
    console.error(chalk.red('Error during integration test:'), error);
  } finally {
    await pool.end();
  }
}

// Run the test
testPatternIntegration().catch(console.error);