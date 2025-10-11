import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Create standalone pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb'
});

async function clearWritingPatterns() {
  console.log(chalk.bold('Clearing Writing Patterns from Database...\n'));
  
  try {
    // Clear patterns from unified tone_preferences table
    console.log(chalk.blue('1. Clearing all tone preferences...'));
    const result = await pool.query(`
      DELETE FROM tone_preferences
      WHERE profile_data->'writingPatterns' IS NOT NULL
    `);
    console.log(chalk.gray(`  Deleted ${result.rowCount} tone preference entries`));
    
    console.log(chalk.green('\n✓ All writing patterns cleared successfully!'));
    console.log(chalk.gray('\nNext time you use the Training panel, it will:'));
    console.log(chalk.gray('  1. Fetch up to 200 emails for the relationship'));
    console.log(chalk.gray('  2. Analyze them to extract new patterns'));
    console.log(chalk.gray('  3. Save the patterns for future use'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pool.end();
  }
}

// Run the script
clearWritingPatterns().catch(console.error);