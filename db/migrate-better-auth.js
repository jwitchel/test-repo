const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Running better-auth table creation...');
    
    // First drop existing tables if they exist
    console.log('Dropping existing better-auth tables...');
    await pool.query(`
      DROP TABLE IF EXISTS "verification" CASCADE;
      DROP TABLE IF EXISTS "account" CASCADE;
      DROP TABLE IF EXISTS "session" CASCADE;
      DROP TABLE IF EXISTS "user" CASCADE;
    `);
    
    // Read and execute the SQL file
    const sql = fs.readFileSync(path.join(__dirname, 'better-auth-schema.sql'), 'utf8');
    await pool.query(sql);
    
    console.log('✅ Better-auth tables created successfully');
    
    // List all tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\nCurrent tables in database:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();