const { Pool } = require('pg');
const { scryptAsync } = require('@noble/hashes/scrypt');
const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');
require('dotenv').config();

// Scrypt configuration matching better-auth
const scryptConfig = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64
};

function constantTimeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

async function verifyPassword(hash, password) {
  try {
    const [salt, key] = hash.split(":");
    const targetKey = await scryptAsync(
      password.normalize("NFKC"),
      salt,
      {
        N: scryptConfig.N,
        r: scryptConfig.r,
        p: scryptConfig.p,
        dkLen: scryptConfig.dkLen,
        maxmem: 128 * scryptConfig.N * scryptConfig.r * 2
      }
    );
    return constantTimeEqual(targetKey, hexToBytes(key));
  } catch (error) {
    console.error('Error in verifyPassword:', error);
    return false;
  }
}

async function testPasswordVerification() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Get the hashed password from database
    const result = await pool.query(
      `SELECT a.password 
       FROM "account" a 
       JOIN "user" u ON a."userId" = u.id 
       WHERE u.email = $1`,
      ['test1@example.com']
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }

    const hashedPassword = result.rows[0].password;
    console.log('📦 Hash from DB:', hashedPassword);
    console.log('Hash parts:', hashedPassword.split(':').map(p => p.length));

    // Test password verification
    const isValid = await verifyPassword(hashedPassword, 'password123');
    console.log('✅ Password valid:', isValid);

    // Test with wrong password
    const isInvalid = await verifyPassword(hashedPassword, 'wrongpassword');
    console.log('❌ Wrong password valid:', isInvalid);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testPasswordVerification();