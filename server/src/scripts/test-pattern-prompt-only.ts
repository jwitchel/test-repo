import { TemplateManager } from '../lib/pipeline/template-manager';
import { WritingPatterns } from '../lib/pipeline/writing-pattern-analyzer';
import dotenv from 'dotenv';
import path from 'path';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function testPatternPrompt() {
  console.log(chalk.bold('Testing Writing Pattern Prompt Integration...\n'));
  
  const templateManager = new TemplateManager();
  
  try {
    // Initialize template manager
    console.log(chalk.blue('1. Initializing template manager...'));
    await templateManager.initialize();
    console.log(chalk.green('✓ Template manager initialized\n'));
    
    // Create sample writing patterns
    const samplePatterns: WritingPatterns = {
      sentencePatterns: {
        avgLength: 18.5,
        minLength: 4,
        maxLength: 42,
        stdDeviation: 9.2,
        distribution: {
          short: 0.20,
          medium: 0.65,
          long: 0.15
        },
        examples: ['Thanks for the update.', 'Let me check on that and get back to you.']
      },
      paragraphPatterns: [
        { type: 'single-line', percentage: 30, description: 'Quick acknowledgments' },
        { type: 'two-paragraph', percentage: 50, description: 'Context then action' },
        { type: 'multi-paragraph', percentage: 20, description: 'Detailed responses' }
      ],
      openingPatterns: [
        { pattern: 'Hi [Name],', frequency: 0.70 },
        { pattern: 'Hey [Name]!', frequency: 0.20 },
        { pattern: '[right to the point]', frequency: 0.10, notes: 'In follow-up threads' }
      ],
      valediction: [
        { phrase: 'Thanks', percentage: 44 },
        { phrase: 'Best', percentage: 35 },
        { phrase: '[None]', percentage: 21 }
      ],
      typedName: [
        { phrase: '-John', percentage: 90 },
        { phrase: '-j', percentage: 5 },
        { phrase: '[None]', percentage: 5 }
      ],
      negativePatterns: [
        // LLM would identify patterns like:
        // - Never uses formal closings ("Regards", "Sincerely")
        // - Avoids business jargon
        // - Never uses ALL CAPS for emphasis
        {
          description: 'None noted',
          confidence: 0.95,
          examples: []
        }
      ],
      responsePatterns: {
        immediate: 0.80,
        contemplative: 0.20,
        questionHandling: 'direct answer first'
      },
      uniqueExpressions: [
        { phrase: 'No worries', context: 'When acknowledging delays', frequency: 0.45 },
        { phrase: 'Makes sense', context: 'Agreement confirmation', frequency: 0.35 }
      ]
    };
    
    // Prepare template data with patterns
    const templateData = {
      recipientEmail: 'colleague@company.com',
      relationship: 'colleague',
      incomingEmail: 'Quick question - can you review the PR before the standup?',
      patterns: samplePatterns,
      exactExamples: [
        {
          text: 'Sure, I\'ll take a look right after my current meeting.',
          subject: 'Re: Code Review',
          formalityScore: 0.4,
          wordCount: 10,
          relationship: 'colleague'
        }
      ],
      meta: {
        exampleCount: 1,
        relationshipMatchCount: 1,
        avgWordCount: 10,
        formalityLevel: 'casual'
      }
    };
    
    // Render the default template
    console.log(chalk.blue('2. Rendering prompt with patterns...'));
    const prompt = await templateManager.renderPrompt('default', templateData);
    console.log(chalk.green('✓ Prompt rendered successfully\n'));
    
    // Check if patterns are included
    if (prompt.includes('WRITING PATTERN INSTRUCTIONS')) {
      console.log(chalk.green('✓ Writing patterns section found in prompt!'));
      
      // Extract and display the patterns section
      const patternsStart = prompt.indexOf('=== WRITING PATTERN INSTRUCTIONS ===');
      const patternsEnd = prompt.indexOf('=== EMAIL TO RESPOND TO ===');
      
      if (patternsStart !== -1 && patternsEnd !== -1) {
        const patternsSection = prompt.substring(patternsStart, patternsEnd);
        console.log(chalk.bold('\n3. Writing Patterns Section:'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(patternsSection.trim());
        console.log(chalk.gray('─'.repeat(60)));
      }
    } else {
      console.log(chalk.yellow('⚠ Writing patterns not found in prompt'));
    }
    
    // Show full prompt length
    console.log(chalk.gray(`\nTotal prompt length: ${prompt.length} characters`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

// Run the test
testPatternPrompt().catch(console.error);