import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Create pool without starting server
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb'
});

async function testConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const result = await pool.query('SELECT NOW()');
    console.log('✓ Database connected:', result.rows[0].now);
    
    // Check if required tables exist
    const tables = ['llm_providers', 'tone_profiles', 'relationship_tone_preferences'];
    for (const table of tables) {
      const exists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);
      console.log(`✓ Table ${table}: ${exists.rows[0].exists ? 'exists' : 'missing'}`);
    }
    
    // Check for active LLM providers
    const providers = await pool.query('SELECT * FROM llm_providers WHERE is_active = true');
    console.log(`✓ Active LLM providers: ${providers.rows.length}`);
    
    if (providers.rows.length > 0) {
      console.log('  First provider:', {
        name: providers.rows[0].provider_name,
        type: providers.rows[0].provider_type,
        model: providers.rows[0].model_name
      });
    }
    
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await pool.end();
  }
}

testConnection();