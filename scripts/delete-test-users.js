const { Pool } = require('pg');
require('dotenv').config();

async function deleteTestUsers() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🗑️  Deleting test users...\n');

    // Delete accounts first (foreign key constraint)
    await pool.query(
      `DELETE FROM "account" WHERE "accountId" IN ('test1@example.com', 'test2@example.com')`
    );

    // Delete users
    const result = await pool.query(
      `DELETE FROM "user" WHERE email IN ('test1@example.com', 'test2@example.com') RETURNING email`
    );

    console.log(`✅ Deleted ${result.rowCount} test users`);

  } catch (error) {
    console.error('❌ Error deleting test users:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
deleteTestUsers();