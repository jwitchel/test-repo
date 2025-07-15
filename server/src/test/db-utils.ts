import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const testDatabaseName = 'aiemaildb_test';
const testConnectionString = `postgresql://aiemailuser:aiemailpass@localhost:5434/${testDatabaseName}`;

export const testPool = new Pool({
  connectionString: testConnectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function setupTestDb() {
  const mainPool = new Pool({
    connectionString: 'postgresql://aiemailuser:aiemailpass@localhost:5434/postgres',
  });

  try {
    await mainPool.query(`CREATE DATABASE ${testDatabaseName}`);
    console.log(`Created test database: ${testDatabaseName}`);
  } catch (error: any) {
    if (error.code !== '42P04') {
      throw error;
    }
    console.log(`Test database ${testDatabaseName} already exists`);
  } finally {
    await mainPool.end();
  }

  try {
    const schemaPath = path.join(__dirname, '..', '..', '..', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await testPool.query(schema);

    const betterAuthSchemaPath = path.join(__dirname, '..', '..', '..', 'db', 'better-auth-schema.sql');
    const betterAuthSchema = fs.readFileSync(betterAuthSchemaPath, 'utf8');
    await testPool.query(betterAuthSchema);

    console.log('Applied database schemas to test database');
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  }
}

export async function cleanupTestDb() {
  try {
    await testPool.query('DROP TABLE IF EXISTS draft_tracking CASCADE');
    await testPool.query('DROP TABLE IF EXISTS tone_profiles CASCADE');
    await testPool.query('DROP TABLE IF EXISTS email_accounts CASCADE');
    
    await testPool.query('DROP TABLE IF EXISTS verification CASCADE');
    await testPool.query('DROP TABLE IF EXISTS session CASCADE');
    await testPool.query('DROP TABLE IF EXISTS account CASCADE');
    await testPool.query('DROP TABLE IF EXISTS "user" CASCADE');

    console.log('Cleaned up test database tables');
  } catch (error) {
    console.error('Error cleaning up test database:', error);
    throw error;
  }
}

export async function seedTestUser(email: string, _password: string) {
  const result = await testPool.query(
    'INSERT INTO "user" (id, email, email_verified, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [
      generateId(),
      email,
      true,
      email.split('@')[0],
      new Date(),
      new Date()
    ]
  );
  
  return result.rows[0];
}

export async function closeTestPool() {
  await testPool.end();
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}