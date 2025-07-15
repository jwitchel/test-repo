const { Pool } = require('pg');
const crypto = require('crypto');
const { scryptAsync } = require('@noble/hashes/scrypt');
const { bytesToHex } = require('@noble/hashes/utils');
require('dotenv').config();

// Scrypt configuration matching better-auth
const scryptConfig = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64
};

const testUsers = [
  {
    email: 'test1@example.com',
    password: 'password123',
    name: 'Test User One',
  },
  {
    email: 'test2@example.com',
    password: 'password456',
    name: 'Test User Two',
  },
];

async function hashPassword(password) {
  // Generate random salt (16 bytes)
  const saltBuffer = crypto.randomBytes(16);
  const salt = bytesToHex(saltBuffer);
  
  // Generate key using scrypt from @noble/hashes (same as better-auth)
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
  
  // Return in better-auth format: salt:key (both hex encoded)
  return `${salt}:${bytesToHex(key)}`;
}

async function createTestUsers() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔄 Creating test users...\n');

    for (const testUser of testUsers) {
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id, email FROM "user" WHERE email = $1',
        [testUser.email]
      );

      if (existingUser.rows.length > 0) {
        console.log(`✅ User already exists: ${testUser.email}`);
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

      console.log(`✅ Created user: ${testUser.email} (password: ${testUser.password})`);
    }

    console.log('\n✨ Test users ready!');
    console.log('\nYou can now sign in with:');
    testUsers.forEach(user => {
      console.log(`  📧 Email: ${user.email}`);
      console.log(`  🔑 Password: ${user.password}\n`);
    });

  } catch (error) {
    console.error('❌ Error creating test users:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
createTestUsers();