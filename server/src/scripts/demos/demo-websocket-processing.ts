#!/usr/bin/env node

import { testEmailGenerator } from '../lib/test-sent-emails';
import { emailProcessor, ProcessingContext } from '../lib/email-processor';
import { imapLogger } from '../lib/imap-logger';
import chalk from 'chalk';

/**
 * Demonstrate WebSocket logging integration with email processing
 */
async function demoWebSocketProcessing() {
  console.log(chalk.bold.cyan('\n🔌 WebSocket Email Processing Demo\n'));
  console.log(chalk.yellow('This demo shows how email processing integrates with real-time WebSocket logging.\n'));
  
  // Simulate user context
  const context: ProcessingContext = {
    userId: 'demo-user-123',
    emailAccountId: 'demo-account-001'
  };
  
  // Get a few test emails
  const testEmails = testEmailGenerator.generateTestEmails().slice(0, 5);
  
  console.log(chalk.bold('Processing emails with WebSocket logging:\n'));
  
  for (const testEmail of testEmails) {
    console.log(chalk.cyan(`\n📧 Processing: ${testEmail.name} (${testEmail.id})`));
    console.log(chalk.gray(`   Category: ${testEmail.category}`));
    console.log(chalk.gray(`   Subject: ${testEmail.subject}`));
    
    // Convert to ParsedMail format
    const parsedMail = testEmailGenerator.convertToParsedMail(testEmail);
    
    // Process the email (this will trigger WebSocket logs)
    const result = emailProcessor.processEmail(parsedMail as any, context);
    
    // Show results
    console.log(chalk.green('✓ Processed successfully'));
    console.log(chalk.gray(`   Original length: ${result.originalPlainLength} chars`));
    console.log(chalk.gray(`   Extracted length: ${result.userTextPlain.length} chars`));
    console.log(chalk.gray(`   Reduction: ${result.originalPlainLength > 0 
      ? Math.round((1 - result.userTextPlain.length / result.originalPlainLength) * 100) 
      : 0}%`));
    console.log(chalk.gray(`   Is reply: ${result.isReply}`));
    console.log(chalk.gray(`   Has quotes: ${result.hasQuotedContent}`));
    
    // Small delay to simulate real processing
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Show log summary
  console.log(chalk.bold.cyan('\n📊 WebSocket Log Summary:\n'));
  const logs = imapLogger.getLogs(context.userId);
  console.log(chalk.gray(`Total logs generated: ${logs.length}`));
  
  // Group logs by command
  const logsByCommand = logs.reduce((acc, log) => {
    acc[log.command] = (acc[log.command] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log(chalk.gray('\nLogs by type:'));
  Object.entries(logsByCommand).forEach(([command, count]) => {
    console.log(chalk.gray(`  ${command}: ${count}`));
  });
  
  console.log(chalk.bold.green('\n✅ Demo complete!'));
  console.log(chalk.yellow('\nTo see these logs in real-time:'));
  console.log(chalk.gray('1. Start the server: npm run dev:all'));
  console.log(chalk.gray('2. Sign in at http://localhost:3001'));
  console.log(chalk.gray('3. Visit http://localhost:3001/imap-logs-demo'));
  console.log(chalk.gray('4. Run this demo again to see logs appear in real-time\n'));
}

// Run the demo
if (require.main === module) {
  demoWebSocketProcessing().catch(console.error);
}

export { demoWebSocketProcessing };