#!/usr/bin/env node

import { Pool } from 'pg';
import { encryptPassword } from '../../lib/crypto';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
// Try .env.local first, then .env
const envPath = path.resolve(__dirname, '../../../../.env.local');
const envPathFallback = path.resolve(__dirname, '../../../../.env');
const fs = require('fs');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(chalk.gray('Loaded environment from .env.local'));
} else {
  dotenv.config({ path: envPathFallback });
  console.log(chalk.gray('Loaded environment from .env'));
}

// Debug: Check if required environment variables are loaded
if (!process.env.DATABASE_URL) {
  console.error(chalk.red('❌ DATABASE_URL not found in environment variables'));
  console.error(chalk.gray('Please ensure your .env file contains DATABASE_URL'));
  process.exit(1);
}

if (!process.env.ENCRYPTION_KEY) {
  console.error(chalk.red('❌ ENCRYPTION_KEY not found in environment variables'));
  console.error(chalk.gray('Please ensure your .env file contains ENCRYPTION_KEY'));
  process.exit(1);
}

// Debug: Show database URL format (without password)
const dbUrl = process.env.DATABASE_URL;
const urlParts = dbUrl.match(/^(postgresql:\/\/[^:]+):[^@]+(@.+)$/);
if (urlParts) {
  console.log(chalk.gray(`Database URL format: ${urlParts[1]}:****${urlParts[2]}`));
}

// Create database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixTestAccountEncryption() {
  console.log(chalk.blue('🔐 Fixing test account password encryption...\n'));

  try {
    // Get all test accounts
    const result = await pool.query(
      `SELECT id, email_address, imap_password_encrypted 
       FROM email_accounts 
       WHERE email_address LIKE '%@testmail.local'`
    );

    if (result.rows.length === 0) {
      console.log(chalk.yellow('⚠️  No test accounts found.'));
      console.log(chalk.gray('Please add user1@testmail.local through Settings > Email Accounts first.'));
      process.exit(0);
    }

    console.log(chalk.gray(`Found ${result.rows.length} test account(s):\n`));

    // Re-encrypt passwords for all test accounts
    const plainPassword = 'testpass123';
    const newEncryptedPassword = encryptPassword(plainPassword);

    for (const account of result.rows) {
      console.log(chalk.gray(`  - ${account.email_address}`));
      
      // Update the database
      await pool.query(
        'UPDATE email_accounts SET imap_password_encrypted = $1 WHERE id = $2',
        [newEncryptedPassword, account.id]
      );
    }

    console.log(chalk.green('\n✅ All test account passwords re-encrypted successfully!'));
    console.log(chalk.gray('\nYou can now use the Training Panel.'));

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  fixTestAccountEncryption();
}