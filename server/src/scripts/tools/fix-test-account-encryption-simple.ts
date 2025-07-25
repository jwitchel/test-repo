#!/usr/bin/env node

import { Pool } from 'pg';
import { encryptPassword } from '../../lib/crypto';
import chalk from 'chalk';

// Simple direct connection without dotenv complexities
const pool = new Pool({
  host: 'localhost',
  port: 5434,
  database: 'aiemaildb',
  user: 'aiemailuser',
  password: 'aiemailpass'
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
  // Check for ENCRYPTION_KEY
  if (!process.env.ENCRYPTION_KEY) {
    // Try to load from .env files
    require('dotenv').config({ path: '.env.local' });
    if (!process.env.ENCRYPTION_KEY) {
      require('dotenv').config({ path: '.env' });
    }
    
    if (!process.env.ENCRYPTION_KEY) {
      console.error(chalk.red('❌ ENCRYPTION_KEY not found'));
      console.error(chalk.gray('Please ensure ENCRYPTION_KEY is set in your .env or .env.local file'));
      process.exit(1);
    }
  }
  
  fixTestAccountEncryption();
}