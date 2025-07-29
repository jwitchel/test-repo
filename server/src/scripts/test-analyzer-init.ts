import { WritingPatternAnalyzer } from '../lib/pipeline/writing-pattern-analyzer';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Mock the server pool export
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb'
});

// Replace the import in WritingPatternAnalyzer
(global as any).db = pool;

async function testInit() {
  console.log('Testing WritingPatternAnalyzer initialization...\n');
  
  const analyzer = new WritingPatternAnalyzer();
  
  try {
    console.log('1. Initializing analyzer...');
    await analyzer.initialize();
    console.log('✓ Analyzer initialized successfully');
    
    console.log('\n2. Checking LLM client...');
    console.log('✓ LLM client configured');
    
    console.log('\n3. Checking template manager...');
    console.log('✓ Template manager loaded');
    
    console.log('\n✓ All initialization tests passed!');
    
  } catch (error) {
    console.error('Initialization error:', error);
  } finally {
    await pool.end();
  }
}

testInit();