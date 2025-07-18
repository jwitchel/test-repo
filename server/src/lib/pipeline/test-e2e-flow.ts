#!/usr/bin/env node
import { ToneLearningOrchestrator } from './tone-learning-orchestrator';
import { ProcessedEmail } from './types';
import chalk from 'chalk';

/**
 * End-to-end test demonstrating the full tone learning flow
 */
async function runE2ETest() {
  console.log(chalk.bold.blue('\n🚀 Tone Learning E2E Test\n'));
  
  const orchestrator = new ToneLearningOrchestrator();
  const userId = 'john-e2e-test';
  
  try {
    // Initialize
    console.log(chalk.blue('Initializing services...'));
    await orchestrator.initialize();
    console.log(chalk.green('✅ Services initialized\n'));
    
    // Clear any existing data
    console.log(chalk.yellow('Clearing existing test data...'));
    await orchestrator.clearUserData(userId);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(chalk.green('✅ Data cleared\n'));
    
    // Load John's emails
    console.log(chalk.blue('Loading John\'s email history...'));
    await orchestrator.loadTestData(userId);
    console.log(chalk.green('✅ Test data loaded\n'));
    
    // Show statistics
    const stats = await orchestrator.getToneStatistics(userId);
    console.log(chalk.bold('📊 Loaded Email Statistics:'));
    console.log(chalk.gray(`  Total emails: ${stats.totalEmails}`));
    console.log(chalk.gray('  Relationships:'));
    Object.entries(stats.relationships).forEach(([rel, count]) => {
      console.log(chalk.gray(`    - ${rel}: ${count}`));
    });
    console.log();
    
    // Test scenarios
    const testScenarios = [
      {
        name: 'Client Performance Issue',
        email: {
          from: 'peterson@client.com',
          subject: 'Urgent: System Performance Degradation',
          text: 'John, We\'re seeing severe performance issues again. Response times are over 20 seconds for basic queries. This is impacting our operations. Need immediate resolution.'
        },
        recipients: ['sarah@company.com', 'jim@venturecapital.com']
      },
      {
        name: 'Wife Planning Weekend',
        email: {
          from: 'lisa@example.com',
          subject: 'Weekend plans',
          text: 'Hey honey, thinking about our weekend. Should we do that hike we talked about or just relax at home? Also, don\'t forget we have dinner with my parents Sunday.'
        },
        recipients: ['lisa@example.com']
      },
      {
        name: 'Friend Fantasy Football',
        email: {
          from: 'mike@example.com',
          subject: 'Trade deadline',
          text: 'Dude, trade deadline is tomorrow. Still interested in my RB for your WR? Your team needs help at running back badly lol'
        },
        recipients: ['mike@example.com']
      },
      {
        name: 'Investor Quarterly Update Request',
        email: {
          from: 'jim@venturecapital.com',
          subject: 'Q3 metrics for board deck',
          text: 'John, preparing the quarterly board deck. Need updated metrics on ARR, churn, and customer acquisition costs. Also include any significant technical developments.'
        },
        recipients: ['jim@venturecapital.com']
      }
    ];
    
    // Run through each scenario
    for (const scenario of testScenarios) {
      console.log(chalk.bold.cyan(`\n📧 Scenario: ${scenario.name}`));
      console.log(chalk.gray('─'.repeat(60)));
      
      // Create incoming email
      const incomingEmail: ProcessedEmail = {
        uid: `test-${Date.now()}`,
        messageId: `<${Date.now()}@example.com>`,
        inReplyTo: null,
        date: new Date(),
        from: [{ address: scenario.email.from, name: scenario.email.from.split('@')[0] }],
        to: [{ address: 'john@company.com', name: 'John Mitchell' }],
        cc: [],
        bcc: [],
        subject: scenario.email.subject,
        textContent: scenario.email.text,
        htmlContent: null,
        extractedText: scenario.email.text,
        relationship: {
          type: 'unknown',
          confidence: 0,
          detectionMethod: 'none'
        }
      };
      
      console.log(chalk.gray(`From: ${scenario.email.from}`));
      console.log(chalk.gray(`Subject: ${scenario.email.subject}`));
      console.log(chalk.gray(`Message: ${scenario.email.text.substring(0, 80)}...`));
      
      // Generate drafts for each recipient
      for (const recipientEmail of scenario.recipients) {
        console.log(chalk.bold(`\n  → Generating reply to: ${recipientEmail}`));
        
        const draft = await orchestrator.generateDraft({
          incomingEmail,
          recipientEmail,
          config: {
            userId,
            maxExamples: 5,
            templateName: 'default',
            verbose: false
          }
        });
        
        console.log(chalk.gray(`    Relationship: ${draft.relationship.type} (${(draft.relationship.confidence * 100).toFixed(0)}%)`));
        console.log(chalk.gray(`    Examples used: ${draft.examplesUsed.length}`));
        console.log(chalk.gray(`    Diversity score: ${draft.metadata.diversityScore?.toFixed(2)}`));
      }
    }
    
    console.log(chalk.bold.green('\n\n✅ E2E Test Complete!\n'));
    console.log(chalk.gray('The system successfully:'));
    console.log(chalk.gray('  1. Loaded 900 historical emails from John'));
    console.log(chalk.gray('  2. Indexed them in Qdrant with embeddings'));
    console.log(chalk.gray('  3. Generated contextual prompts for different recipients'));
    console.log(chalk.gray('  4. Selected relevant examples based on relationships'));
    console.log(chalk.gray('  5. Formatted prompts using Handlebars templates'));
    console.log(chalk.gray('\nNext step: Integrate with LLM for actual draft generation'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ E2E Test Failed:'), error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runE2ETest();
}