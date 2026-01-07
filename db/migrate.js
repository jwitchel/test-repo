const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb'
});

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function isMigrationApplied(client, name) {
  const result = await client.query(
    'SELECT 1 FROM schema_migrations WHERE name = $1',
    [name]
  );
  return result.rows.length > 0;
}

async function recordMigration(client, name) {
  await client.query(
    'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
    [name]
  );
}

// Map old schema names to new migration files for backwards compatibility
const LEGACY_SCHEMA_MAP = {
  'better-auth-schema': '000_better_auth_schema.sql',
  'base-schema': '001_base_schema.sql',
  'relationship-schema': '002_relationship_schema.sql'
};

async function migrateLegacySchemaRecords(client) {
  // If old schema records exist, map them to new migration names
  for (const [oldName, newName] of Object.entries(LEGACY_SCHEMA_MAP)) {
    if (await isMigrationApplied(client, oldName)) {
      await recordMigration(client, newName);
    }
  }
}

async function runMigration() {
  const client = await pool.connect();

  try {
    // Create migrations tracking table first
    await ensureMigrationsTable(client);

    // Migrate legacy schema records to new naming convention
    await migrateLegacySchemaRecords(client);

    // Run all migrations in order from db/migrations
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      if (await isMigrationApplied(client, file)) {
        console.log(`Migration ${file} already applied, skipping`);
        continue;
      }

      try {
        const migration = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(migration);
        await recordMigration(client, file);
        console.log(`Migration ${file} completed`);
      } catch (error) {
        console.error(`Migration ${file} failed:`, error.message);
        throw error; // Stop on failure - don't continue with broken state
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
