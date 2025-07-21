const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb'
});

async function runMigration() {
  try {
    // Run better-auth schema first (creates user table)
    const betterAuthSchema = fs.readFileSync(path.join(__dirname, 'better-auth-schema.sql'), 'utf8');
    await pool.query(betterAuthSchema);
    console.log('Better-auth schema migration completed');
    
    // Run the original schema
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Base schema migration completed');
    
    // Run the relationship schema
    const relationshipSchema = fs.readFileSync(path.join(__dirname, 'relationship-schema.sql'), 'utf8');
    await pool.query(relationshipSchema);
    console.log('Relationship schema migration completed');
    
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();