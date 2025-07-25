#!/usr/bin/env node

import { Pool } from 'pg';
import { encryptPassword, decryptPassword } from '../../lib/crypto';
import chalk from 'chalk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '../../../../.env');
dotenv.config({ path: envPath });

if (!process.env.ENCRYPTION_KEY) {
  console.error(chalk.red('❌ ENCRYPTION_KEY not found in .env'));
  process.exit(1);
}

const pool = new Pool({
  host: 'localhost',
  port: 5434,
  database: 'aiemaildb',
  user: 'aiemailuser',
  password: 'aiemailpass'
});

async function fixTestAccountEncryption() {
  console.log(chalk.blue('🔐 Comprehensive fix for test account password encryption...\n'));

  try {
    // Get all test accounts
    const result = await pool.query(
      `SELECT id, email_address, imap_password_encrypted 
       FROM email_accounts 
       WHERE email_address LIKE '%@testmail.local'`
    );

    if (result.rows.length === 0) {
      console.log(chalk.yellow('⚠️  No test accounts found.'));
      process.exit(0);
    }

    console.log(chalk.gray(`Found ${result.rows.length} test account(s):\n`));

    // Test the encryption/decryption cycle
    const testPassword = 'testpass123';
    console.log(chalk.gray('Testing encryption/decryption cycle...'));
    
    try {
      const testEncrypted = encryptPassword(testPassword);
      decryptPassword(testEncrypted); // Test that decryption works
      console.log(chalk.green('✓ Encryption/decryption test passed\n'));
    } catch (error) {
      console.error(chalk.red('✗ Encryption/decryption test failed:'), error);
      process.exit(1);
    }

    // Re-encrypt passwords for all test accounts
    const newEncryptedPassword = encryptPassword(testPassword);
    console.log(chalk.gray('New encrypted password format:'));
    console.log(chalk.gray(`  Parts: ${newEncryptedPassword.split(':').length}`));
    console.log(chalk.gray(`  Length: ${newEncryptedPassword.length}\n`));

    for (const account of result.rows) {
      console.log(chalk.gray(`Updating ${account.email_address}...`));
      
      // Test if current password can be decrypted
      try {
        const currentDecrypted = decryptPassword(account.imap_password_encrypted);
        console.log(chalk.yellow(`  - Current password decrypts to: "${currentDecrypted}"`));
      } catch (error) {
        console.log(chalk.red(`  - Current password cannot be decrypted`));
      }
      
      // Update with new encryption
      await pool.query(
        'UPDATE email_accounts SET imap_password_encrypted = $1 WHERE id = $2',
        [newEncryptedPassword, account.id]
      );
      
      // Verify the update
      const verifyResult = await pool.query(
        'SELECT imap_password_encrypted FROM email_accounts WHERE id = $1',
        [account.id]
      );
      
      try {
        const verifyDecrypted = decryptPassword(verifyResult.rows[0].imap_password_encrypted);
        console.log(chalk.green(`  ✓ Updated and verified (decrypts to: "${verifyDecrypted}")`));
      } catch (error) {
        console.log(chalk.red(`  ✗ Update verification failed`));
      }
    }

    console.log(chalk.green('\n✅ All test account passwords re-encrypted successfully!'));
    
    // Final verification
    console.log(chalk.gray('\nFinal verification:'));
    const finalResult = await pool.query(
      `SELECT email_address, imap_password_encrypted 
       FROM email_accounts 
       WHERE email_address LIKE '%@testmail.local'`
    );
    
    for (const account of finalResult.rows) {
      try {
        const decrypted = decryptPassword(account.imap_password_encrypted);
        console.log(chalk.green(`  ✓ ${account.email_address}: OK (decrypts to: "${decrypted}")`));
      } catch (error) {
        console.log(chalk.red(`  ✗ ${account.email_address}: FAILED`));
      }
    }

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