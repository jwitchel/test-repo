#!/usr/bin/env node
const { execSync } = require('child_process');
const { Pool } = require('pg');
const crypto = require('crypto');
const { scryptAsync } = require('@noble/hashes/scrypt');
const { bytesToHex } = require('@noble/hashes/utils');
require('dotenv').config();

// Test users configuration - matching between DB and email server
const TEST_USERS = [
  {
    email: 'user1@testmail.local',
    password: 'testpass123',
    name: 'Test User One',
  },
  {
    email: 'user2@testmail.local',
    password: 'testpass456',
    name: 'Test User Two',
  },
];

// Scrypt configuration matching better-auth
const scryptConfig = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64
};

async function hashPassword(password) {
  const saltBuffer = crypto.randomBytes(16);
  const salt = bytesToHex(saltBuffer);
  
  const key = await scryptAsync(
    password.normalize('NFKC'),
    salt,
    {
      N: scryptConfig.N,
      r: scryptConfig.r,
      p: scryptConfig.p,
      dkLen: scryptConfig.dkLen,
      maxmem: 128 * scryptConfig.N * scryptConfig.r * 2
    }
  );
  
  return `${salt}:${bytesToHex(key)}`;
}

async function setupEmailAccounts() {
  console.log('📧 Setting up test email accounts...\n');

  try {
    // Check if mailserver is running
    const containers = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
    if (!containers.includes('test-mailserver')) {
      console.log('⚠️  Test mailserver not running. Starting it now...');
      execSync('docker compose up -d test-mailserver', { stdio: 'inherit' });
      
      // Wait for mailserver to be ready
      console.log('⏳ Waiting for mailserver to be ready...');
      await new Promise(resolve => setTimeout(resolve, 15000));
    }

    // Create email accounts
    for (const user of TEST_USERS) {
      try {
        console.log(`Creating email account: ${user.email}`);
        execSync(`docker exec test-mailserver setup email add ${user.email} ${user.password}`, {
          stdio: 'pipe'
        });
        console.log(`✅ Created email account: ${user.email}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`✅ Email account already exists: ${user.email}`);
        } else {
          throw error;
        }
      }
    }

    // Create IMAP folders
    console.log('\n📁 Creating IMAP folders...');
    for (const user of TEST_USERS) {
      try {
        execSync(`docker exec test-mailserver doveadm mailbox create -u ${user.email} "INBOX.AI-Ready"`, {
          stdio: 'pipe'
        });
        console.log(`✅ Created INBOX.AI-Ready folder for ${user.email}`);
      } catch (error) {
        // Folder might already exist, that's ok
        console.log(`📁 INBOX.AI-Ready folder may already exist for ${user.email}`);
      }
    }

  } catch (error) {
    console.error('❌ Error setting up email accounts:', error.message);
    throw error;
  }
}

async function setupDatabaseUsers() {
  console.log('\n💾 Setting up database test users...\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    for (const testUser of TEST_USERS) {
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id, email FROM "user" WHERE email = $1',
        [testUser.email]
      );

      if (existingUser.rows.length > 0) {
        console.log(`✅ Database user already exists: ${testUser.email}`);
        continue;
      }

      // Generate user ID
      const userId = crypto.randomUUID();

      // Hash password using scrypt (same as better-auth)
      const hashedPassword = await hashPassword(testUser.password);

      // Create user
      await pool.query(
        `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          testUser.email,
          testUser.name,
          true, // emailVerified
          new Date(),
          new Date(),
        ]
      );

      // Create account record for email/password auth
      const accountId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO "account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          accountId,
          userId,
          testUser.email, // accountId is typically the email for email/password
          'credential', // providerId for email/password
          hashedPassword,
          new Date(),
          new Date(),
        ]
      );

      console.log(`✅ Created database user: ${testUser.email}`);
    }

  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('🚀 Seeding test data for AI Email Assistant\n');
  console.log('This will set up both email accounts and database users.\n');

  try {
    // Setup email accounts first
    await setupEmailAccounts();

    // Then setup database users
    await setupDatabaseUsers();

    console.log('\n✨ Test data setup complete!\n');
    console.log('You can now use these test accounts:');
    console.log('━'.repeat(50));
    TEST_USERS.forEach(user => {
      console.log(`📧 Email: ${user.email}`);
      console.log(`🔑 Password: ${user.password}`);
      console.log(`👤 Name: ${user.name}`);
      console.log('━'.repeat(50));
    });
    console.log('\nThese accounts work for both IMAP email access and web login.');

  } catch (error) {
    console.error('\n❌ Error during setup:', error);
    process.exit(1);
  }
}

// Run the script
main();