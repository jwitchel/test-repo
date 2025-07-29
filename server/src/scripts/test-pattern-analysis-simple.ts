import dotenv from 'dotenv';
import path from 'path';
import chalk from 'chalk';

// Set environment variable to prevent server start BEFORE any imports
process.env.SKIP_SERVER_START = 'true';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function testPatternAnalysis() {
  console.log(chalk.bold('Testing Pattern Analysis via API...\n'));
  
  try {
    // Use the logged-in user's session
    const response = await fetch('http://localhost:3002/api/analyze/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'test-auth-session=test-session'
      },
      body: JSON.stringify({
        emailBody: "Hey! Quick question about the metrics dashboard - do you have the latest version ready? The team is asking for an update.",
        recipientEmail: "colleague@company.com",
        relationshipType: "colleague",
        providerId: "b23f7fab-50dc-4a83-8408-b2e9b1bdefe8"
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} - ${error}`);
    }
    
    const result: any = await response.json();
    
    console.log(chalk.blue('Response received:'));
    console.log(chalk.gray('- Has NLP features:', !!result.nlpFeatures));
    console.log(chalk.gray('- Relationship:', result.relationship?.type));
    console.log(chalk.gray('- Examples found:', result.selectedExamples?.length || 0));
    console.log(chalk.gray('- Has writing patterns:', !!result.writingPatterns));
    
    if (result.writingPatterns) {
      console.log(chalk.green('\n✓ Writing patterns analyzed successfully!'));
      console.log(chalk.gray('\nPattern summary:'));
      const patterns = result.writingPatterns;
      console.log(chalk.gray(`  - Sentence avg length: ${patterns.sentencePatterns.avgLength.toFixed(1)} words`));
      console.log(chalk.gray(`  - Opening patterns: ${patterns.openingPatterns.length}`));
      console.log(chalk.gray(`  - Closing patterns: ${patterns.closingPatterns.length}`));
      console.log(chalk.gray(`  - Unique expressions: ${patterns.uniqueExpressions.length}`));
      console.log(chalk.gray(`  - Negative patterns: ${patterns.negativePatterns.length}`));
      
      console.log(chalk.gray('\nSample patterns:'));
      if (patterns.openingPatterns.length > 0) {
        console.log(chalk.gray('  Opening: ' + patterns.openingPatterns[0].pattern));
      }
      if (patterns.closingPatterns.length > 0) {
        console.log(chalk.gray('  Closing: ' + patterns.closingPatterns[0].pattern));
      }
    } else {
      console.log(chalk.yellow('\n⚠ No writing patterns found in response'));
      console.log(chalk.gray('This might mean:'));
      console.log(chalk.gray('  1. No emails were found for analysis'));
      console.log(chalk.gray('  2. Pattern analysis is disabled'));
      console.log(chalk.gray('  3. An error occurred during analysis'));
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

// Run the test
testPatternAnalysis().catch(console.error);