const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function setupTestAccounts() {
  try {
    // Check if we have test accounts
    const checkResult = await pool.query(
      `SELECT COUNT(*) FROM email_accounts WHERE email_address LIKE '%@testmail.local'`
    );
    
    if (checkResult.rows[0].count > 0) {
      console.log('Test accounts already exist');
      const accounts = await pool.query(
        `SELECT id, email_address FROM email_accounts WHERE email_address LIKE '%@testmail.local'`
      );
      console.log('Available test accounts:');
      accounts.rows.forEach(account => {
        console.log(`- ${account.email_address} (ID: ${account.id})`);
      });
      return;
    }
    
    // Get a test user
    const userResult = await pool.query(
      `SELECT id FROM "user" LIMIT 1`
    );
    
    if (userResult.rows.length === 0) {
      console.error('No users found. Please create a user first.');
      process.exit(1);
    }
    
    const userId = userResult.rows[0].id;
    console.log(`Using user ID: ${userId}`);
    
    // Create test email accounts
    const testAccounts = [
      {
        email: 'user1@testmail.local',
        username: 'user1@testmail.local',
        password: 'testpass123'
      },
      {
        email: 'user2@testmail.local',
        username: 'user2@testmail.local',
        password: 'testpass123'
      }
    ];
    
    for (const account of testAccounts) {
      // Simple encryption (just for test - in production use proper encryption)
      const encryptedPassword = Buffer.from(account.password).toString('base64');
      
      const result = await pool.query(
        `INSERT INTO email_accounts
         (user_id, email_address, imap_host, imap_port, imap_username, imap_password_encrypted, imap_secure)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [userId, account.email, 'localhost', 1143, account.username, encryptedPassword, false]
      );
      
      console.log(`Created test account: ${account.email} (ID: ${result.rows[0].id})`);
    }
    
    console.log('\nTest accounts created successfully!');
    console.log('You can now use these accounts in the Inspector.');
    
  } catch (error) {
    console.error('Error setting up test accounts:', error);
  } finally {
    await pool.end();
  }
}

setupTestAccounts();