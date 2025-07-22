import { AggregatedStyle } from '../../lib/style/style-aggregation-service';

export interface DemoUser {
  email: string;
  password: string;
  name: string;
}

export interface DemoEmail {
  subject: string;
  body: string;
  recipientEmail: string;
  recipientName: string;
  relationshipType: string;
}

export interface DemoPerson {
  name: string;
  emails: string[];
  relationships: Array<{
    type: string;
    isPrimary: boolean;
  }>;
}

// Test users
export const DEMO_USERS: DemoUser[] = [
  {
    email: 'test1@example.com',
    password: 'password123',
    name: 'Test User One',
  },
  {
    email: 'test2@example.com',
    password: 'password456',
    name: 'Test User Two',
  },
];

// Default relationship types
export const DEFAULT_RELATIONSHIPS = [
  { type: 'spouse', display: 'Spouse/Partner' },
  { type: 'family', display: 'Family' },
  { type: 'close_friends', display: 'Close Friends' },
  { type: 'friends', display: 'Friends' },
  { type: 'colleague', display: 'Colleagues' },
  { type: 'manager', display: 'Manager/Boss' },
  { type: 'clients', display: 'Clients' },
  { type: 'external', display: 'External/Other' }
];

// Demo people (recipients)
export const DEMO_PEOPLE: DemoPerson[] = [
  // Colleagues
  {
    name: 'Sarah Johnson',
    emails: ['sarah@company.com'],
    relationships: [{ type: 'colleague', isPrimary: true }]
  },
  {
    name: 'Mike Chen',
    emails: ['mike@company.com'],
    relationships: [{ type: 'colleague', isPrimary: true }]
  },
  {
    name: 'Team',
    emails: ['team@company.com'],
    relationships: [{ type: 'colleague', isPrimary: true }]
  },
  
  // Friends
  {
    name: 'John Smith',
    emails: ['john@gmail.com'],
    relationships: [{ type: 'friends', isPrimary: true }]
  },
  {
    name: 'Emma Wilson',
    emails: ['emma@gmail.com'],
    relationships: [{ type: 'friends', isPrimary: true }]
  },
  {
    name: 'Friend',
    emails: ['friend@gmail.com'],
    relationships: [{ type: 'friends', isPrimary: true }]
  },
  
  // Managers
  {
    name: 'Jennifer Martinez',
    emails: ['jennifer@company.com'],
    relationships: [{ type: 'manager', isPrimary: true }]
  },
  {
    name: 'Robert Anderson',
    emails: ['robert@company.com'],
    relationships: [{ type: 'manager', isPrimary: true }]
  },
  {
    name: 'Leadership Team',
    emails: ['leadership@company.com'],
    relationships: [{ type: 'manager', isPrimary: true }]
  }
];

// Demo emails
export const DEMO_EMAILS: DemoEmail[] = [
  // Colleague emails
  {
    subject: 'Re: Project Update',
    body: `Hi Sarah,

Thanks for the update on the project timeline. I've reviewed the changes and they look good to me.

A few quick thoughts:
- The API integration timeline seems reasonable
- Let's make sure we have proper error handling in place
- I'll coordinate with the QA team for testing

Let me know if you need anything else from my end. Looking forward to our sync tomorrow.

Best,
Alex`,
    recipientEmail: 'sarah@company.com',
    recipientName: 'Sarah',
    relationshipType: 'colleague'
  },
  {
    subject: 'Re: Code Review Request',
    body: `Hey Mike,

I've gone through your PR and left some comments. Overall it looks solid! 👍

The implementation is clean and well-documented. Just a couple of minor suggestions:
- Consider adding some unit tests for the edge cases
- Maybe we can extract that validation logic into a separate function?

Thanks for taking care of this. Let me know if you want to discuss any of the feedback.

Regards,
Alex`,
    recipientEmail: 'mike@company.com',
    recipientName: 'Mike',
    relationshipType: 'colleague'
  },
  {
    subject: 'Re: Meeting Notes',
    body: `Good morning team,

Following up on our discussion yesterday. I've attached the meeting notes with action items.

Key takeaways:
- We're moving forward with the new deployment strategy
- Each team will provide status updates by EOD Friday
- I'll schedule follow-up sessions with stakeholders

Please review and let me know if I missed anything. Thanks for your input during the meeting! 🙏

Cheers,
Alex`,
    recipientEmail: 'team@company.com',
    recipientName: 'Team',
    relationshipType: 'colleague'
  },
  
  // Friend emails
  {
    subject: 'Re: Weekend plans?',
    body: `Hey John! 😊

Haha yeah, Saturday sounds perfect! I'm totally down for brunch at that new place. 

The reviews look amazing and I've been wanting to try their pancakes forever 😂 Should we make a reservation or just show up? Either way works for me.

Oh btw, did you see the game last night? Absolutely insane finish! 🎉

Talk soon,
Alex`,
    recipientEmail: 'john@gmail.com',
    recipientName: 'John',
    relationshipType: 'friends'
  },
  {
    subject: 'Re: That was hilarious!',
    body: `Yo Emma!

I'm still laughing about last night 😂😂😂 That karaoke performance was LEGENDARY!

We definitely need to do that again soon. Maybe we can get the whole crew together next time? I'll check with everyone and see who's free next weekend.

BTW thanks for the photos - they're pure gold! Already made one my profile pic 😅

Later!
Alex`,
    recipientEmail: 'emma@gmail.com',
    recipientName: 'Emma',
    relationshipType: 'friends'
  },
  {
    subject: 'Re: Birthday party',
    body: `Hey!

Count me in! 🎉 Wouldn't miss it for the world!

I'll bring some drinks and maybe that dip everyone loved last time? Let me know if you need me to grab anything else.

Can't wait to celebrate with you! It's gonna be epic 🍻

Cheers,
Alex`,
    recipientEmail: 'friend@gmail.com',
    recipientName: 'Friend',
    relationshipType: 'friends'
  },
  
  // Manager emails
  {
    subject: 'Re: Q3 Performance Review',
    body: `Good morning Jennifer,

Thank you for scheduling the performance review meeting. I have prepared my self-assessment and project summaries as requested.

I would like to discuss the following during our meeting:
- Progress on the current initiatives
- Professional development opportunities for Q4
- Team expansion plans and resource allocation

I am available at your convenience. Please let me know if you need any additional documentation before our meeting.

Best regards,
Alex Thompson`,
    recipientEmail: 'jennifer@company.com',
    recipientName: 'Jennifer',
    relationshipType: 'manager'
  },
  {
    subject: 'Re: Budget Proposal',
    body: `Hello Robert,

I have reviewed the budget proposal for the upcoming fiscal year. The allocations appear to align well with our strategic objectives.

I have a few observations:
- The increase in technology infrastructure investment is justified given our growth projections
- Marketing spend efficiency has improved significantly
- We may want to consider additional resources for customer success

I appreciate your thorough analysis. I am available to discuss this further at your earliest convenience.

Thank you,
Alex Thompson`,
    recipientEmail: 'robert@company.com',
    recipientName: 'Robert',
    relationshipType: 'manager'
  },
  {
    subject: 'Re: Strategic Planning Session',
    body: `Good afternoon,

Thank you for including me in the strategic planning session. I found the discussion on market expansion particularly insightful.

Following our conversation, I have compiled my thoughts on the proposed initiatives:
- The international expansion timeline seems aggressive but achievable
- Risk mitigation strategies are comprehensive
- Success metrics are well-defined and measurable

I look forward to contributing to the implementation phase. Please let me know how I can best support these efforts moving forward.

Best regards,
Alex Thompson`,
    recipientEmail: 'leadership@company.com',
    recipientName: 'Leadership Team',
    relationshipType: 'manager'
  }
];

// Aggregated style patterns for each relationship type
export const DEMO_STYLES: Record<string, AggregatedStyle> = {
  colleague: {
    greetings: [
      { text: 'Hi', frequency: 45, percentage: 35 },
      { text: 'Hey', frequency: 32, percentage: 25 },
      { text: 'Good morning', frequency: 28, percentage: 22 },
      { text: 'Hello', frequency: 23, percentage: 18 }
    ],
    closings: [
      { text: 'Best', frequency: 42, percentage: 33 },
      { text: 'Thanks', frequency: 38, percentage: 30 },
      { text: 'Regards', frequency: 25, percentage: 20 },
      { text: 'Cheers', frequency: 22, percentage: 17 }
    ],
    emojis: [
      { emoji: '😊', frequency: 15, contexts: ['greeting', 'positive feedback'] },
      { emoji: '👍', frequency: 12, contexts: ['acknowledgment', 'approval'] },
      { emoji: '🙏', frequency: 8, contexts: ['thanks', 'request'] }
    ],
    contractions: {
      uses: true,
      frequency: 0.65,
      examples: ["I'll", "won't", "can't", "we're", "it's"]
    },
    sentimentProfile: {
      primaryTone: 'positive',
      averageWarmth: 0.72,
      averageFormality: 0.45
    },
    vocabularyProfile: {
      complexityLevel: 'moderate',
      technicalTerms: ['API', 'implementation', 'deployment', 'review'],
      commonPhrases: [
        { phrase: 'let me know', frequency: 25 },
        { phrase: 'sounds good', frequency: 18 },
        { phrase: 'thanks for', frequency: 15 },
        { phrase: 'looking forward', frequency: 12 }
      ]
    },
    structuralPatterns: {
      averageEmailLength: 125,
      averageSentenceLength: 15.3,
      paragraphingStyle: 'short'
    },
    emailCount: 128,
    confidenceScore: 0.85,
    lastUpdated: new Date().toISOString()
  },
  friends: {
    greetings: [
      { text: 'Hey', frequency: 65, percentage: 45 },
      { text: 'Hi', frequency: 42, percentage: 29 },
      { text: 'Yo', frequency: 25, percentage: 17 },
      { text: 'Hello', frequency: 13, percentage: 9 }
    ],
    closings: [
      { text: 'Later', frequency: 35, percentage: 28 },
      { text: 'Talk soon', frequency: 32, percentage: 26 },
      { text: 'Cheers', frequency: 30, percentage: 24 },
      { text: 'Take care', frequency: 28, percentage: 22 }
    ],
    emojis: [
      { emoji: '😂', frequency: 45, contexts: ['humor', 'reaction'] },
      { emoji: '🎉', frequency: 28, contexts: ['celebration', 'excitement'] },
      { emoji: '😊', frequency: 25, contexts: ['friendly', 'positive'] },
      { emoji: '🍻', frequency: 18, contexts: ['plans', 'celebration'] },
      { emoji: '😅', frequency: 15, contexts: ['awkward', 'humor'] }
    ],
    contractions: {
      uses: true,
      frequency: 0.82,
      examples: ["I'm", "you're", "it's", "we'll", "that's", "didn't"]
    },
    sentimentProfile: {
      primaryTone: 'enthusiastic',
      averageWarmth: 0.88,
      averageFormality: 0.15
    },
    vocabularyProfile: {
      complexityLevel: 'simple',
      technicalTerms: [],
      commonPhrases: [
        { phrase: 'haha', frequency: 42 },
        { phrase: 'no worries', frequency: 35 },
        { phrase: 'sounds fun', frequency: 28 },
        { phrase: 'catch up', frequency: 22 }
      ]
    },
    structuralPatterns: {
      averageEmailLength: 85,
      averageSentenceLength: 12.5,
      paragraphingStyle: 'casual'
    },
    emailCount: 245,
    confidenceScore: 0.92,
    lastUpdated: new Date().toISOString()
  },
  manager: {
    greetings: [
      { text: 'Good morning', frequency: 45, percentage: 38 },
      { text: 'Hi', frequency: 35, percentage: 30 },
      { text: 'Hello', frequency: 28, percentage: 24 },
      { text: 'Good afternoon', frequency: 10, percentage: 8 }
    ],
    closings: [
      { text: 'Best regards', frequency: 48, percentage: 40 },
      { text: 'Thanks', frequency: 35, percentage: 29 },
      { text: 'Thank you', frequency: 22, percentage: 18 },
      { text: 'Best', frequency: 15, percentage: 13 }
    ],
    emojis: [],
    contractions: {
      uses: false,
      frequency: 0.05,
      examples: []
    },
    sentimentProfile: {
      primaryTone: 'professional',
      averageWarmth: 0.45,
      averageFormality: 0.85
    },
    vocabularyProfile: {
      complexityLevel: 'sophisticated',
      technicalTerms: ['deliverables', 'KPIs', 'stakeholders', 'alignment'],
      commonPhrases: [
        { phrase: 'please let me know', frequency: 18 },
        { phrase: 'at your earliest convenience', frequency: 12 },
        { phrase: 'I appreciate', frequency: 15 },
        { phrase: 'moving forward', frequency: 10 }
      ]
    },
    structuralPatterns: {
      averageEmailLength: 185,
      averageSentenceLength: 18.2,
      paragraphingStyle: 'formal'
    },
    emailCount: 92,
    confidenceScore: 0.78,
    lastUpdated: new Date().toISOString()
  }
};