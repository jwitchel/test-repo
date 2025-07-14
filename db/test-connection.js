const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb'
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected:', result.rows[0]);
    
    // List all tables
    const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    console.log('Tables:', tables.rows.map(r => r.tablename));
  } catch (error) {
    console.error('Connection failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();