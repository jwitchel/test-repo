#!/usr/bin/env node

import _ from 'highland';
import { testEmailGenerator } from '../lib/test-sent-emails';
import { createPipelineFromEmails, processEmailBatch } from '../lib/sent-email-pipeline';
import chalk from 'chalk';
import { ParsedMail } from 'mailparser';

/**
 * Demonstrate the Highland.js email processing pipeline
 */
async function demoHighlandPipeline() {
  console.log(chalk.bold.cyan('\n🏔️  Highland.js Email Pipeline Demo\n'));
  console.log(chalk.yellow('This demo shows the single-stream Highland.js pipeline processing emails.\n'));
  
  // Check concurrency setting
  const concurrency = process.env.EMAIL_PIPELINE_CONCURRENCY || '1';
  console.log(chalk.gray(`Pipeline concurrency: ${concurrency} (set EMAIL_PIPELINE_CONCURRENCY to change)\n`));
  
  // Generate test emails
  const testEmails = testEmailGenerator.generateTestEmails();
  const parsedEmails = testEmails.map(email => 
    testEmailGenerator.convertToParsedMail(email) as unknown as ParsedMail
  );
  
  console.log(chalk.bold(`Generated ${parsedEmails.length} test emails\n`));
  
  // Demo 1: Stream Processing with Real-time Updates
  console.log(chalk.bold.blue('Demo 1: Stream Processing with Real-time Updates'));
  console.log(chalk.gray('Processing emails in batches of 5...\n'));
  
  const { stream, pipeline } = createPipelineFromEmails(parsedEmails.slice(0, 15), {
    userId: 'demo-user-123',
    emailAccountId: 'demo-account-001',
    batchSize: 5,
    onBatchComplete: (batch) => {
      console.log(chalk.green(`✓ Batch completed: ${batch.length} emails processed`));
      batch.forEach(email => {
        console.log(chalk.gray(`  - ${email.messageId}: ${email.userTextPlain.substring(0, 50)}...`));
      });
    }
  });
  
  await new Promise((resolve, reject) => {
    stream
      .collect()
      .toCallback((err) => {
        if (err) reject(err);
        else {
          const metrics = pipeline.complete();
          console.log(chalk.bold.green('\n✅ Pipeline completed!'));
          console.log(chalk.gray(`Total processed: ${metrics.processedCount}`));
          console.log(chalk.gray(`Errors: ${metrics.errorCount}`));
          console.log(chalk.gray(`Duration: ${((metrics.endTime! - metrics.startTime) / 1000).toFixed(2)}s`));
          resolve(null);
        }
      });
  });
  
  // Demo 2: Error Handling
  console.log(chalk.bold.blue('\n\nDemo 2: Error Handling'));
  console.log(chalk.gray('Processing emails with simulated errors...\n'));
  
  // Create emails with some that will cause errors
  const emailsWithErrors = parsedEmails.slice(0, 10).map((email, index) => {
    if (index % 3 === 0) {
      // Simulate corrupted email by removing text content
      return { ...email, text: '', html: false } as ParsedMail;
    }
    return email;
  });
  
  const errorResults = await processEmailBatch(emailsWithErrors, {
    userId: 'demo-user-123',
    emailAccountId: 'demo-account-001',
    batchSize: 3
  });
  
  console.log(chalk.green(`✓ Processed with error handling`));
  console.log(chalk.gray(`Successfully processed: ${errorResults.results.length}`));
  console.log(chalk.gray(`Errors encountered: ${errorResults.metrics.errorCount}`));
  console.log(chalk.gray(`Success rate: ${((errorResults.results.length / emailsWithErrors.length) * 100).toFixed(0)}%`));
  
  // Demo 3: Performance Test
  console.log(chalk.bold.blue('\n\nDemo 3: Performance Test'));
  console.log(chalk.gray('Processing larger batch to test performance...\n'));
  
  // Generate more emails for performance test
  const largeEmailSet: ParsedMail[] = [];
  for (let i = 0; i < 100; i++) {
    const randomEmail = testEmails[i % testEmails.length];
    largeEmailSet.push(testEmailGenerator.convertToParsedMail(randomEmail) as unknown as ParsedMail);
  }
  
  const startTime = Date.now();
  const perfResults = await processEmailBatch(largeEmailSet, {
    userId: 'demo-user-123',
    emailAccountId: 'demo-account-001',
    batchSize: 20
  });
  const endTime = Date.now();
  
  console.log(chalk.green(`✓ Performance test completed`));
  console.log(chalk.gray(`Emails processed: ${perfResults.results.length}`));
  console.log(chalk.gray(`Total time: ${((endTime - startTime) / 1000).toFixed(2)}s`));
  console.log(chalk.gray(`Emails/second: ${(perfResults.results.length / ((endTime - startTime) / 1000)).toFixed(2)}`));
  console.log(chalk.gray(`Memory used: ${perfResults.metrics.memoryUsage ? 
    Math.round(perfResults.metrics.memoryUsage.heapUsed / 1024 / 1024) : 'N/A'} MB`));
  
  // Demo 4: Backpressure Demonstration
  console.log(chalk.bold.blue('\n\nDemo 4: Backpressure Handling'));
  console.log(chalk.gray('Demonstrating rate limiting (1 batch per 100ms)...\n'));
  
  const backpressureStart = Date.now();
  let batchCount = 0;
  
  const { stream: bpStream, pipeline: bpPipeline } = createPipelineFromEmails(parsedEmails.slice(0, 20), {
    userId: 'demo-user-123',
    emailAccountId: 'demo-account-001',
    batchSize: 2,
    onBatchComplete: () => {
      batchCount++;
      const elapsed = Date.now() - backpressureStart;
      console.log(chalk.gray(`Batch ${batchCount} at ${elapsed}ms`));
    }
  });
  
  await new Promise((resolve) => {
    bpStream.collect().toCallback(() => {
      bpPipeline.complete();
      const totalTime = Date.now() - backpressureStart;
      console.log(chalk.green(`\n✓ Backpressure test completed`));
      console.log(chalk.gray(`Total batches: ${batchCount}`));
      console.log(chalk.gray(`Total time: ${totalTime}ms`));
      console.log(chalk.gray(`Average time per batch: ${(totalTime / batchCount).toFixed(0)}ms`));
      resolve(null);
    });
  });
  
  console.log(chalk.bold.green('\n\n✅ All demos completed!'));
  console.log(chalk.yellow('\nKey features demonstrated:'));
  console.log(chalk.gray('- Single-stream processing (configurable via EMAIL_PIPELINE_CONCURRENCY)'));
  console.log(chalk.gray('- Batch processing with configurable batch size'));
  console.log(chalk.gray('- Error handling with graceful recovery'));
  console.log(chalk.gray('- Real-time progress tracking'));
  console.log(chalk.gray('- Backpressure handling with rate limiting'));
  console.log(chalk.gray('- Memory-efficient processing'));
}

// Run the demo
if (require.main === module) {
  demoHighlandPipeline().catch(console.error);
}

export { demoHighlandPipeline };