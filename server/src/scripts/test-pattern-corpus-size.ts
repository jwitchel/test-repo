import { WritingPatternAnalyzer } from '../lib/pipeline/writing-pattern-analyzer';
import { VectorStore } from '../lib/vector/qdrant-client';
import { pool } from '../server';
import dotenv from 'dotenv';
import path from 'path';
import chalk from 'chalk';

// Set environment variable to prevent server start BEFORE any imports
process.env.SKIP_SERVER_START = 'true';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function testPatternCorpusSize() {
  console.log(chalk.bold('Testing Pattern Analysis with Large Corpus...\n'));
  
  const analyzer = new WritingPatternAnalyzer();
  const vectorStore = new VectorStore();
  
  try {
    // Initialize services
    console.log(chalk.blue('1. Initializing services...'));
    await vectorStore.initialize();
    await analyzer.initialize(); // Will use default LLM provider
    console.log(chalk.green('✓ Services initialized\n'));
    
    // Get test user ID
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', ['test1@example.com']);
    if (userResult.rows.length === 0) {
      throw new Error('Test user not found');
    }
    const userId = userResult.rows[0].id;
    console.log(chalk.gray(`Using test user ID: ${userId}\n`));
    
    // Get relationship stats
    console.log(chalk.blue('2. Getting relationship statistics...'));
    const stats = await vectorStore.getRelationshipStats(userId);
    console.log(chalk.gray('Relationship stats:'));
    Object.entries(stats).forEach(([relationship, count]) => {
      console.log(chalk.gray(`  ${relationship}: ${count} emails`));
    });
    console.log();
    
    // Test different corpus sizes
    const relationships = ['colleague', 'friend', 'unknown'];
    
    for (const relationship of relationships) {
      if (!stats[relationship] || stats[relationship] === 0) {
        console.log(chalk.yellow(`Skipping ${relationship} - no emails found\n`));
        continue;
      }
      
      console.log(chalk.blue(`3. Testing ${relationship} relationship...`));
      
      // Fetch corpus
      console.log(chalk.gray('  Fetching email corpus...'));
      const corpus = await vectorStore.getByRelationship(userId, relationship, 200);
      console.log(chalk.gray(`  Found ${corpus.length} emails`));
      
      if (corpus.length > 0) {
        // Convert to ProcessedEmail format
        const emailsForAnalysis = corpus.map(result => ({
          uid: result.id,
          messageId: result.id,
          inReplyTo: null,
          date: new Date(result.metadata.sentDate || Date.now()),
          from: [{ address: userId, name: '' }],
          to: [{ address: result.metadata.recipientEmail, name: '' }],
          cc: [],
          bcc: [],
          subject: result.metadata.subject || '',
          textContent: result.metadata.userReply || '',
          htmlContent: null,
          userReply: result.metadata.userReply || '',
          respondedTo: ''
        }));
        
        // Analyze patterns
        console.log(chalk.gray(`  Analyzing patterns from ${emailsForAnalysis.length} emails...`));
        const startTime = Date.now();
        
        const patterns = await analyzer.analyzeWritingPatterns(
          userId,
          emailsForAnalysis,
          relationship
        );
        
        const duration = Date.now() - startTime;
        console.log(chalk.green(`  ✓ Analysis completed in ${(duration / 1000).toFixed(2)}s`));
        
        // Display results
        console.log(chalk.gray('  Pattern summary:'));
        console.log(chalk.gray(`    - Sentence avg length: ${patterns.sentencePatterns.avgLength.toFixed(1)} words`));
        console.log(chalk.gray(`    - Opening patterns: ${patterns.openingPatterns.length}`));
        console.log(chalk.gray(`    - Valedictions: ${patterns.valediction.length}`));
        console.log(chalk.gray(`    - Unique expressions: ${patterns.uniqueExpressions.length}`));
        console.log(chalk.gray(`    - Negative patterns: ${patterns.negativePatterns.length}`));
        
        // Save patterns
        console.log(chalk.gray('  Saving patterns to database...'));
        await analyzer.savePatterns(userId, patterns, relationship, emailsForAnalysis.length);
        console.log(chalk.green('  ✓ Patterns saved\n'));
      }
    }
    
    console.log(chalk.green('✓ All tests completed!'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pool.end();
  }
}

// Run the test
testPatternCorpusSize().catch(console.error);