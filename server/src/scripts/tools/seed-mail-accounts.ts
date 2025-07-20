#!/usr/bin/env node

import chalk from 'chalk';
import { execSync } from 'child_process';

interface TestAccount {
  email: string;
  password: string;
}

const testAccounts: TestAccount[] = [
  { email: 'user1@testmail.local', password: 'testpass123' },
  { email: 'user2@testmail.local', password: 'testpass123' },
  { email: 'user3@testmail.local', password: 'testpass123' }
];

async function createMailAccounts() {
  console.log(chalk.blue('📧 Creating test mail accounts...\n'));

  try {
    // Check if the mail server container is running
    try {
      execSync('docker ps | grep test-mailserver', { stdio: 'pipe' });
    } catch (error) {
      console.error(chalk.red('❌ Error: test-mailserver container is not running.'));
      console.log(chalk.yellow('Please run: npm run mail:up'));
      process.exit(1);
    }

    // Wait a moment for the server to be ready
    console.log(chalk.gray('Waiting for mail server to be ready...'));
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create each account
    for (const account of testAccounts) {
      try {
        console.log(chalk.gray(`Creating account: ${account.email}`));
        
        // Create the account using docker exec
        // Note: mailserver/docker-mailserver uses setup email add command
        execSync(
          `docker exec test-mailserver setup email add ${account.email} ${account.password}`,
          { stdio: 'pipe' }
        );
        
        console.log(chalk.green(`✅ Created: ${account.email}`));
      } catch (error) {
        // Account might already exist, which is fine
        console.log(chalk.yellow(`⚠️  Account may already exist: ${account.email}`));
      }
    }

    console.log(chalk.green('\n✨ Test mail accounts ready!'));
    console.log(chalk.gray('\nYou can use these accounts for IMAP testing:'));
    testAccounts.forEach(account => {
      console.log(chalk.gray(`  - ${account.email} / ${account.password}`));
    });
    console.log(chalk.gray('\nIMAP Server: localhost'));
    console.log(chalk.gray('Port: 1143 (non-SSL) or 1993 (SSL)'));

  } catch (error) {
    console.error(chalk.red('❌ Error creating mail accounts:'), error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  createMailAccounts();
}