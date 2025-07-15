const { Pool } = require('pg');
require('dotenv').config();

async function fixSessionTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔧 Checking session table structure...\n');

    // Check current columns
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'session'
      ORDER BY ordinal_position;
    `);

    console.log('Current columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Check if updatedAt exists
    const hasUpdatedAt = result.rows.some(row => row.column_name === 'updatedAt');
    const hasIpAddress = result.rows.some(row => row.column_name === 'ipAddress');
    const hasUserAgent = result.rows.some(row => row.column_name === 'userAgent');

    let columnsAdded = false;

    if (!hasUpdatedAt) {
      console.log('\n❌ Missing updatedAt column. Adding it...');
      
      await pool.query(`
        ALTER TABLE "session" 
        ADD COLUMN "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      `);

      console.log('✅ Added updatedAt column');
      columnsAdded = true;
    }

    if (!hasIpAddress) {
      console.log('\n❌ Missing ipAddress column. Adding it...');
      
      await pool.query(`
        ALTER TABLE "session" 
        ADD COLUMN "ipAddress" TEXT
      `);

      console.log('✅ Added ipAddress column');
      columnsAdded = true;
    }

    if (!hasUserAgent) {
      console.log('\n❌ Missing userAgent column. Adding it...');
      
      await pool.query(`
        ALTER TABLE "session" 
        ADD COLUMN "userAgent" TEXT
      `);

      console.log('✅ Added userAgent column');
      columnsAdded = true;
    }

    if (!columnsAdded) {
      console.log('\n✅ All required columns already exist');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixSessionTable();