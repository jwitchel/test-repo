#!/usr/bin/env node
import { PromptFormatter } from '../../lib/pipeline/prompt-formatter';
import { SelectedExample } from '../../lib/pipeline/example-selector';
import { RelationshipProfile } from '../../lib/pipeline/types';

// Create sample examples for testing
const createSampleExamples = (): SelectedExample[] => [
  {
    id: 'ex1',
    text: "Hey honey! I'll be home by 7pm tonight. Love you!",
    metadata: {
      relationship: { type: 'spouse', confidence: 0.95, detectionMethod: 'manual' },
      features: {
        stats: { formalityScore: 0.1, wordCount: 10 },
        sentiment: { dominant: 'positive' },
        urgency: { level: 'low' }
      },
      wordCount: 10,
      subject: 'Re: Dinner plans'
    },
    score: 0.95
  },
  {
    id: 'ex2',
    text: "Running a bit late, traffic is crazy. Be there in 30 mins!",
    metadata: {
      relationship: { type: 'spouse', confidence: 0.9, detectionMethod: 'auto' },
      features: {
        stats: { formalityScore: 0.15, wordCount: 12 },
        sentiment: { dominant: 'neutral' },
        urgency: { level: 'medium' }
      },
      wordCount: 12,
      subject: 'Re: Movie night'
    },
    score: 0.88
  },
  {
    id: 'ex3',
    text: "Hi John, I've reviewed the proposal and have some feedback. Can we schedule a meeting this week?",
    metadata: {
      relationship: { type: 'colleagues', confidence: 0.85, detectionMethod: 'auto' },
      features: {
        stats: { formalityScore: 0.7, wordCount: 16 },
        sentiment: { dominant: 'neutral' },
        urgency: { level: 'medium' }
      },
      wordCount: 16,
      subject: 'Re: Q3 Proposal'
    },
    score: 0.75
  },
  {
    id: 'ex4',
    text: "Thanks for the quick turnaround! The report looks great. I'll share it with the team.",
    metadata: {
      relationship: { type: 'colleagues', confidence: 0.9, detectionMethod: 'auto' },
      features: {
        stats: { formalityScore: 0.6, wordCount: 14 },
        sentiment: { dominant: 'positive' },
        urgency: { level: 'low' }
      },
      wordCount: 14,
      subject: 'Re: Monthly report'
    },
    score: 0.82
  }
];

const spouseProfile: RelationshipProfile = {
  typicalFormality: 'very casual',
  commonGreetings: ['Hey honey', 'Hi babe', 'Hey'],
  commonClosings: ['Love you', 'xoxo', 'Love'],
  useEmojis: true,
  useHumor: true
};

const colleagueProfile: RelationshipProfile = {
  typicalFormality: 'professional',
  commonGreetings: ['Hi', 'Hello', 'Good morning'],
  commonClosings: ['Thanks', 'Best regards', 'Best'],
  useEmojis: false,
  useHumor: false
};

async function testPromptFormatter() {
  console.log('🎨 Testing Prompt Formatter\n');
  
  const formatter = new PromptFormatter();
  const examples = createSampleExamples();

  // Test 1: Basic prompt formatting with spouse examples
  console.log('1️⃣ Testing basic prompt formatting (spouse relationship)...\n');
  
  const spousePrompt = formatter.formatWithExamples({
    incomingEmail: "When will you be home tonight?",
    recipientEmail: "sarah@gmail.com",
    relationship: "spouse",
    examples: examples.filter(e => ['spouse', 'colleagues'].includes(e.metadata.relationship.type)),
    relationshipProfile: spouseProfile
  });
  
  console.log('Generated Prompt:');
  console.log('─'.repeat(80));
  console.log(spousePrompt);
  console.log('─'.repeat(80));
  console.log('');

  // Test 2: Structured prompt with metadata
  console.log('2️⃣ Testing structured prompt formatting...\n');
  
  const structuredResult = formatter.formatWithExamplesStructured({
    incomingEmail: "Can we discuss the project timeline?",
    recipientEmail: "john@company.com",
    relationship: "colleagues",
    examples,
    relationshipProfile: colleagueProfile
  });
  
  console.log('Metadata:', structuredResult.metadata);
  console.log('');

  // Test 3: System prompt
  console.log('3️⃣ Testing system prompt...\n');
  const systemPrompt = formatter.formatSystemPrompt();
  console.log('System Prompt (first 200 chars):');
  console.log(systemPrompt.substring(0, 200) + '...\n');

  // Test 4: Conversation format
  console.log('4️⃣ Testing conversation format...\n');
  const conversationFormat = formatter.formatExamplesAsConversation(examples.slice(0, 2));
  console.log('Conversation Format:');
  console.log('─'.repeat(80));
  console.log(conversationFormat);
  console.log('─'.repeat(80));
  console.log('');

  // Test 5: Minimal prompt
  console.log('5️⃣ Testing minimal prompt...\n');
  const minimalPrompt = formatter.formatMinimalPrompt({
    incomingEmail: "Are you free for lunch?",
    recipientEmail: "mike@gmail.com",
    relationship: "friends",
    topExamples: examples.slice(0, 2)
  });
  console.log('Minimal Prompt:');
  console.log(minimalPrompt);
  console.log('');

  // Test 6: Style-focused prompt
  console.log('6️⃣ Testing style-focused prompt...\n');
  const styleFocusedPrompt = formatter.formatStyleFocusedPrompt({
    incomingEmail: "Need the report by EOD",
    recipientEmail: "boss@company.com",
    relationship: "manager",
    examples,
    styleEmphasis: {
      formality: true,
      brevity: true,
      professionalPhrases: true
    }
  });
  console.log('Style-Focused Prompt (last 300 chars):');
  console.log('...' + styleFocusedPrompt.slice(-300));
  console.log('');

  // Test 7: No relationship profile
  console.log('7️⃣ Testing without relationship profile...\n');
  const noProfilePrompt = formatter.formatWithExamples({
    incomingEmail: "What time is the meeting?",
    recipientEmail: "team@company.com",
    relationship: "colleagues",
    examples: examples.filter(e => e.metadata.relationship.type === 'colleagues'),
    relationshipProfile: null
  });
  console.log('Has relationship context:', noProfilePrompt.includes('Relationship context'));
  console.log('Example count in prompt:', (noProfilePrompt.match(/Example \d+/g) || []).length);
  
  console.log('\n✅ All prompt formatting tests completed!');
}

// Run the test
if (require.main === module) {
  testPromptFormatter().catch(console.error);
}

export { testPromptFormatter };