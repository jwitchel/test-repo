import { WritingPatternAnalyzer } from '../lib/pipeline/writing-pattern-analyzer';
import { ProcessedEmail } from '../lib/pipeline/types';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Sample emails for testing
const sampleEmails: ProcessedEmail[] = [
  {
    uid: '1',
    messageId: 'msg1@example.com',
    inReplyTo: null,
    date: new Date('2024-01-15'),
    from: [{ address: 'john@example.com', name: 'John' }],
    to: [{ address: 'sarah@company.com', name: 'Sarah' }],
    cc: [],
    bcc: [],
    subject: 'Q3 Report Review',
    textContent: `Hi Sarah,

I've reviewed the Q3 report. The numbers look good overall.

Quick question - can we get more details on the subscription renewals?

Thanks,
John`,
    htmlContent: null,
    extractedText: `Hi Sarah,

I've reviewed the Q3 report. The numbers look good overall.

Quick question - can we get more details on the subscription renewals?

Thanks,
John`
  },
  {
    uid: '2',
    messageId: 'msg2@example.com',
    inReplyTo: null,
    date: new Date('2024-01-16'),
    from: [{ address: 'john@example.com', name: 'John' }],
    to: [{ address: 'mike@gmail.com', name: 'Mike' }],
    cc: [],
    bcc: [],
    subject: 'Weekend plans',
    textContent: `Hey Mike!

Still up for hiking this weekend? Weather looks perfect.

Let me know!
John`,
    htmlContent: null,
    extractedText: `Hey Mike!

Still up for hiking this weekend? Weather looks perfect.

Let me know!
John`
  },
  {
    uid: '3',
    messageId: 'msg3@example.com',
    inReplyTo: 'msg0@example.com',
    date: new Date('2024-01-17'),
    from: [{ address: 'john@example.com', name: 'John' }],
    to: [{ address: 'client@business.com', name: 'Client' }],
    cc: [],
    bcc: [],
    subject: 'RE: Project Update',
    textContent: `Thanks for the update. I'll review and get back to you by EOD tomorrow.

Best,
John`,
    htmlContent: null,
    extractedText: `Thanks for the update. I'll review and get back to you by EOD tomorrow.

Best,
John`
  }
];

async function testAnalyzer() {
  console.log('Testing Writing Pattern Analyzer with Handlebars templates...\n');
  
  const analyzer = new WritingPatternAnalyzer();
  
  try {
    // Initialize with default LLM provider
    console.log('1. Initializing analyzer (loading templates)...');
    await analyzer.initialize();
    console.log('✓ Analyzer initialized with templates\n');
    
    // Analyze patterns
    console.log('2. Analyzing writing patterns from sample emails...');
    const patterns = await analyzer.analyzeWritingPatterns(
      'test-user-123',
      sampleEmails
    );
    
    console.log('✓ Analysis complete!\n');
    console.log('3. Results:');
    console.log(JSON.stringify(patterns, null, 2));
    
    // Test saving patterns
    console.log('\n4. Saving patterns to database...');
    await analyzer.savePatterns('test-user-123', patterns, undefined, sampleEmails.length);
    console.log('✓ Patterns saved\n');
    
    // Test loading patterns
    console.log('5. Loading patterns from database...');
    const loadedPatterns = await analyzer.loadPatterns('test-user-123');
    console.log('✓ Patterns loaded');
    console.log('Loaded data matches saved:', JSON.stringify(loadedPatterns) === JSON.stringify(patterns));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testAnalyzer().catch(console.error);