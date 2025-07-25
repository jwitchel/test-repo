#!/usr/bin/env node

import { ImapOperations } from '../../lib/imap-operations';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function testImapSearch() {
  console.log(chalk.blue('🔍 Testing IMAP search...\n'));

  try {
    const emailAccountId = '3a7587dd-cadb-47d0-bfb1-122dbd1f4e01'; // user2@testmail.local
    const userId = '78c4277a-b94c-428d-9f52-4fca9992177a';
    
    console.log(chalk.gray('Creating IMAP connection...'));
    const imapOps = await ImapOperations.fromAccountId(emailAccountId, userId);
    
    // Test 1: Search ALL in Sent folder
    console.log(chalk.yellow('\nTest 1: Search ALL in Sent folder'));
    try {
      const allMessages = await imapOps.searchMessages('Sent', {});
      console.log(chalk.green(`✓ Found ${allMessages.length} messages total`));
      if (allMessages.length > 0) {
        console.log(chalk.gray(`  First message UID: ${allMessages[0].uid}`));
        console.log(chalk.gray(`  Last message UID: ${allMessages[allMessages.length - 1].uid}`));
      }
    } catch (err) {
      console.log(chalk.red(`✗ Error: ${err instanceof Error ? err.message : String(err)}`));
    }
    
    // Test 2: Search with BEFORE criteria
    console.log(chalk.yellow('\nTest 2: Search with BEFORE 2025-07-26'));
    try {
      const beforeDate = new Date('2025-07-26');
      const beforeMessages = await imapOps.searchMessages('Sent', { before: beforeDate });
      console.log(chalk.green(`✓ Found ${beforeMessages.length} messages before ${beforeDate.toISOString()}`));
    } catch (err) {
      console.log(chalk.red(`✗ Error: ${err instanceof Error ? err.message : String(err)}`));
    }
    
    // Test 3: Search with BEFORE criteria (older date)
    console.log(chalk.yellow('\nTest 3: Search with BEFORE 2024-12-01'));
    try {
      const beforeDate = new Date('2024-12-01');
      const beforeMessages = await imapOps.searchMessages('Sent', { before: beforeDate });
      console.log(chalk.green(`✓ Found ${beforeMessages.length} messages before ${beforeDate.toISOString()}`));
    } catch (err) {
      console.log(chalk.red(`✗ Error: ${err instanceof Error ? err.message : String(err)}`));
    }
    
    // Test 4: Get folder list
    console.log(chalk.yellow('\nTest 4: List all folders'));
    try {
      const folders = await imapOps.getFolders();
      console.log(chalk.green('✓ Available folders:'));
      folders.forEach((folder: any) => {
        console.log(chalk.gray(`  - ${folder.name}`));
      });
    } catch (err) {
      console.log(chalk.red(`✗ Error: ${err instanceof Error ? err.message : String(err)}`));
    }
    
    // Test 5: Fetch a sample message
    console.log(chalk.yellow('\nTest 5: Fetch a sample message'));
    try {
      const messages = await imapOps.searchMessages('Sent', {}, { limit: 1 });
      if (messages.length > 0) {
        const fullMessage = await imapOps.getMessage('Sent', messages[0].uid);
        console.log(chalk.green('✓ Sample message:'));
        console.log(chalk.gray(`  UID: ${messages[0].uid}`));
        console.log(chalk.gray(`  Date: ${fullMessage.parsed?.date}`));
        console.log(chalk.gray(`  Subject: ${fullMessage.parsed?.subject}`));
        console.log(chalk.gray(`  From: ${fullMessage.parsed?.from?.text}`));
      }
    } catch (err) {
      console.log(chalk.red(`✗ Error: ${err instanceof Error ? err.message : String(err)}`));
    }
    
    // Release the connection back to the pool
    imapOps.release();
    console.log(chalk.blue('\n✅ Test completed'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  testImapSearch();
}