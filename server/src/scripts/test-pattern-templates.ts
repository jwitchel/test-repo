import { TemplateManager } from '../lib/pipeline/template-manager';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function testTemplates() {
  console.log('Testing Pattern Analysis Templates...\n');
  
  const templateManager = new TemplateManager();
  
  try {
    // Initialize template manager
    await templateManager.initialize();
    console.log('✓ Template manager initialized\n');
    
    // Test data
    const testData = {
      emailCount: 3,
      relationship: 'colleague',
      emails: [
        {
          date: '2024-01-15T10:00:00Z',
          to: 'sarah@company.com',
          subject: 'Q3 Report',
          content: 'Hi Sarah,\n\nHope this helps.\n\nThanks,\nJohn'
        },
        {
          date: '2024-01-16T14:00:00Z',
          to: 'mike@gmail.com',
          subject: 'Weekend',
          content: 'Hey Mike!\n\nSounds good!\n\nJohn'
        }
      ]
    };
    
    // Test system prompt
    console.log('1. Testing pattern-analysis system prompt...');
    const systemPrompt = await templateManager.renderSystemPrompt('pattern-analysis');
    console.log('System Prompt (first 200 chars):', systemPrompt.substring(0, 200) + '...\n');
    
    // Test user prompt
    console.log('2. Testing pattern-analysis user prompt...');
    const userPrompt = await templateManager.renderPrompt('pattern-analysis', testData as any);
    console.log('User Prompt (first 400 chars):', userPrompt.substring(0, 400) + '...\n');
    
    // Verify JSON structure request is included
    console.log('3. Verifying JSON structure is requested...');
    const hasJsonStructure = userPrompt.includes('Return ONLY a JSON object');
    console.log('JSON structure requested:', hasJsonStructure ? '✓ Yes' : '✗ No');
    
    // Verify all pattern types are included
    console.log('\n4. Verifying all pattern types are included:');
    const patternTypes = [
      'SENTENCE PATTERNS',
      'PARAGRAPH STRUCTURE',
      'OPENINGS',
      'CLOSINGS',
      'WHAT THEY NEVER DO',
      'RESPONSE PATTERNS',
      'UNIQUE EXPRESSIONS'
    ];
    
    patternTypes.forEach(pattern => {
      const included = userPrompt.includes(pattern);
      console.log(`  ${pattern}: ${included ? '✓' : '✗'}`);
    });
    
    console.log('\n✓ Template testing complete!');
    
  } catch (error) {
    console.error('Error testing templates:', error);
  }
}

// Run the test
testTemplates().catch(console.error);