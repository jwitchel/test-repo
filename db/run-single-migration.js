const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb'
});

async function runSingleMigration(filename) {
  try {
    const migrationPath = path.join(__dirname, 'migrations', filename);
    const migration = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migration);
    console.log(`Migration ${filename} completed successfully`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get filename from command line argument
const filename = process.argv[2];
if (!filename) {
  console.error('Please provide a migration filename');
  process.exit(1);
}

runSingleMigration(filename);