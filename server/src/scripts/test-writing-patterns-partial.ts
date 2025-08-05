import { TemplateManager } from '../lib/pipeline/template-manager';
import { WritingPatterns } from '../lib/pipeline/writing-pattern-analyzer';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function testWritingPatternsPartial() {
  console.log('Testing Writing Patterns Partial...\n');
  
  const templateManager = new TemplateManager();
  
  try {
    // Initialize template manager to load partials
    await templateManager.initialize();
    console.log('✓ Template manager initialized\n');
    
    // Sample writing patterns data
    const testPatterns: WritingPatterns = {
      sentencePatterns: {
        avgLength: 15.3,
        minLength: 3,
        maxLength: 45,
        stdDeviation: 8.5,
        distribution: {
          short: 0.25,
          medium: 0.60,
          long: 0.15
        },
        examples: ['Thanks!', 'Let me know if you need anything else.']
      },
      paragraphPatterns: [
        { type: 'single-line', percentage: 40, description: 'Brief, direct responses' },
        { type: 'two-paragraph', percentage: 45, description: 'Question then answer' },
        { type: 'multi-paragraph', percentage: 15, description: 'Detailed explanations' }
      ],
      openingPatterns: [
        { pattern: 'Hi [Name],', frequency: 0.60 },
        { pattern: 'Hey!', frequency: 0.25 },
        { pattern: '[right to the point]', frequency: 0.10, notes: 'Skips greeting in follow-ups' },
        { pattern: '[Name] -', frequency: 0.05 }
      ],
      valediction: [
        { phrase: 'Thanks', percentage: 50 },
        { phrase: 'Best', percentage: 30 },
        { phrase: '[None]', percentage: 20 }
      ],
      typedName: [
        { phrase: 'John', percentage: 80 },
        { phrase: '-J', percentage: 10 },
        { phrase: '[None]', percentage: 10 }
      ],
      negativePatterns: [
        // Example patterns that would be identified by the LLM:
        // - Never uses formal salutations like "Dear" or "Regards"
        // - Avoids corporate jargon ("synergize", "circle back", etc.)
        // - Never uses excessive punctuation ("!!!", "...")
        {
          description: 'None noted',
          confidence: 0.95,
          examples: []
        }
      ],
      responsePatterns: {
        immediate: 0.70,
        contemplative: 0.30,
        questionHandling: 'direct'
      },
      uniqueExpressions: [
        { phrase: 'Does that make sense?', context: 'After explanations', frequency: 0.30 },
        { phrase: 'Quick question -', context: 'Email openings', frequency: 0.15 },
        { phrase: 'Let me know', context: 'Closing requests', frequency: 0.25 }
      ]
    };
    
    // Create a simple template that uses the partial
    const testTemplate = `Test Template with Writing Patterns:

{{> writing-patterns patterns=patterns}}

End of test template.`;
    
    // Import Handlebars to compile the template
    const Handlebars = require('handlebars');
    
    // Compile and render the template
    const compiled = Handlebars.compile(testTemplate);
    const rendered = compiled({ patterns: testPatterns });
    
    console.log('Rendered output:\n');
    console.log('─'.repeat(80));
    console.log(rendered);
    console.log('─'.repeat(80));
    
    // Verify key sections are present
    console.log('\n✓ Verification:');
    const checks = [
      'WRITING PATTERN INSTRUCTIONS',
      'SENTENCE STRUCTURE',
      'PARAGRAPH STRUCTURE',
      'OPENINGS',
      'CLOSINGS',
      'NEVER DO THESE THINGS',
      'RESPONSE STYLE',
      'UNIQUE PHRASES TO USE'
    ];
    
    checks.forEach(section => {
      const present = rendered.includes(section);
      console.log(`  ${section}: ${present ? '✓' : '✗'}`);
    });
    
    console.log('\n✓ Writing patterns partial test complete!');
    
  } catch (error) {
    console.error('Error testing partial:', error);
  }
}

// Run the test
testWritingPatternsPartial().catch(console.error);