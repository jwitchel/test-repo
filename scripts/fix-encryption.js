const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

function encryptPassword(password) {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(encryptionKey, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(password, 'utf8'),
    cipher.final()
  ]);
  
  const tag = cipher.getAuthTag();
  
  // Combine salt, iv, tag, and encrypted data
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  
  return combined.toString('base64');
}

async function fixEncryption() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb'
  });

  try {
    console.log('🔧 Checking LLM providers...');
    
    // Get all providers
    const result = await pool.query('SELECT id, provider_name FROM llm_providers');
    
    if (result.rows.length === 0) {
      console.log('✅ No LLM providers found. Nothing to fix.');
      return;
    }
    
    console.log(`Found ${result.rows.length} provider(s)`);
    
    // For demo purposes, we'll re-encrypt with a dummy key
    // In production, you'd need to decrypt with old key first
    console.log('\n⚠️  WARNING: This will reset all API keys to a demo value.');
    console.log('You will need to update each provider with the actual API key.\n');
    
    for (const provider of result.rows) {
      console.log(`Updating ${provider.provider_name}...`);
      
      // Encrypt a placeholder API key
      const placeholderKey = 'UPDATE_ME_WITH_ACTUAL_API_KEY';
      const encryptedKey = encryptPassword(placeholderKey);
      
      await pool.query(
        'UPDATE llm_providers SET api_key_encrypted = $1 WHERE id = $2',
        [encryptedKey, provider.id]
      );
      
      console.log(`✅ Updated ${provider.provider_name}`);
    }
    
    console.log('\n✅ All providers updated.');
    console.log('⚠️  Remember to update each provider with the actual API key in the settings page.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixEncryption();