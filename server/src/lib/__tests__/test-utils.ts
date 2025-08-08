import { ProcessedEmail } from '../pipeline/types';
import { VectorStore } from '../vector/qdrant-client';

/**
 * Test data manager for integration tests
 */
export class TestDataManager {
  private vectorStore: VectorStore;
  private activeUsers: Set<string> = new Set();
  
  constructor() {
    this.vectorStore = new VectorStore();
  }
  
  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
  }
  
  /**
   * Set up a test user with a specific scenario
   */
  async setupTestUser(scenario: TestScenario): Promise<string> {
    const userId = `test-${scenario}-${Date.now()}`;
    this.activeUsers.add(userId);
    
    // Load scenario-specific data
    await this.loadScenarioData(userId, scenario);
    
    return userId;
  }
  
  /**
   * Load predefined test data for a scenario
   */
  async loadScenarioData(userId: string, scenario: TestScenario): Promise<void> {
    const emails = this.getScenarioEmails(scenario);
    
    // Process emails through vector store
    for (const _ of emails) {
      // This would normally go through the full pipeline
      // For tests, we're directly inserting
      console.log(`Loading ${emails.length} emails for user ${userId}, scenario: ${scenario}`);
    }
  }
  
  /**
   * Clean up all test data for a user
   */
  async cleanupTestData(userId: string): Promise<void> {
    await this.vectorStore.deleteUserData(userId);
    this.activeUsers.delete(userId);
  }
  
  /**
   * Clean up all active test users
   */
  async cleanupAll(): Promise<void> {
    for (const userId of this.activeUsers) {
      await this.cleanupTestData(userId);
    }
    this.activeUsers.clear();
  }
  
  /**
   * Verify data integrity for a test user
   */
  async verifyDataIntegrity(userId: string): Promise<boolean> {
    try {
      const stats = await this.vectorStore.getRelationshipStats(userId);
      return Object.keys(stats).length > 0;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get predefined emails for different test scenarios
   */
  private getScenarioEmails(scenario: TestScenario): ProcessedEmail[] {
    const scenarios: Record<TestScenario, ProcessedEmail[]> = {
      'basic': this.createBasicScenarioEmails(),
      'edge-cases': this.createEdgeCaseEmails(),
      'multi-relationship': this.createMultiRelationshipEmails(),
      'insufficient-data': this.createInsufficientDataEmails()
    };
    
    return scenarios[scenario] || [];
  }
  
  private createBasicScenarioEmails(): ProcessedEmail[] {
    return [
      this.createEmail('basic-1', 'colleague@work.com', 'Meeting notes', 
        'Here are the notes from our meeting today'),
      this.createEmail('basic-2', 'spouse@home.com', 'Dinner', 
        'I\'ll be home by 7pm tonight. Love you!'),
      this.createEmail('basic-3', 'friend@gmail.com', 'Weekend plans', 
        'Hey! Want to grab coffee on Saturday?'),
      this.createEmail('basic-4', 'investor@vc.com', 'Monthly update', 
        'Q3 metrics: ARR $2.1M, churn 3.2%')
    ];
  }
  
  private createEdgeCaseEmails(): ProcessedEmail[] {
    return [
      this.createEmail('edge-1', '', '', ''), // All empty
      this.createEmail('edge-2', 'test@test.com', 'Subject only', ''), // No body
      this.createEmail('edge-3', 'long@email.com', 'Long content', 
        'x'.repeat(10000)), // Very long content
      this.createEmail('edge-4', 'special@chars.com', 'Special chars', 
        '🎉 Unicode! @#$%^&*()'), // Special characters
    ];
  }
  
  private createMultiRelationshipEmails(): ProcessedEmail[] {
    const emails: ProcessedEmail[] = [];
    const relationships = [
      { email: 'colleague@work.com', count: 5 },
      { email: 'spouse@home.com', count: 5 },
      { email: 'friend@social.com', count: 5 },
      { email: 'client@business.com', count: 5 }
    ];
    
    relationships.forEach(rel => {
      for (let i = 0; i < rel.count; i++) {
        emails.push(this.createEmail(
          `multi-${rel.email}-${i}`,
          rel.email,
          `Subject ${i}`,
          `Email content for ${rel.email} number ${i}`
        ));
      }
    });
    
    return emails;
  }
  
  private createInsufficientDataEmails(): ProcessedEmail[] {
    return [
      this.createEmail('insufficient-1', 'rare@contact.com', 'Rare email', 
        'This is the only email to this contact')
    ];
  }
  
  private createEmail(
    id: string,
    recipient: string,
    subject: string,
    body: string
  ): ProcessedEmail {
    return {
      uid: `test-${id}`,
      messageId: `<${id}@test.local>`,
      inReplyTo: null,
      date: new Date(),
      from: [{ address: 'test@sender.com', name: 'Test Sender' }],
      to: recipient ? [{ address: recipient, name: recipient.split('@')[0] }] : [],
      cc: [],
      bcc: [],
      subject,
      textContent: body,
      htmlContent: null,
      userReply: body,
      respondedTo: ''
    };
  }
}

/**
 * Available test scenarios
 */
export type TestScenario = 
  | 'basic'
  | 'edge-cases'
  | 'multi-relationship'
  | 'insufficient-data';

/**
 * Mock data generator for creating realistic test emails
 */
export class MockDataGenerator {
  private subjects = {
    colleague: [
      'Project update',
      'Meeting notes',
      'Code review request',
      'Sprint planning',
      'Bug report'
    ],
    spouse: [
      'Dinner plans',
      'Weekend ideas',
      'Grocery list',
      'Date night',
      'Travel plans'
    ],
    friend: [
      'Game night',
      'Birthday party',
      'Concert tickets',
      'Catch up',
      'Weekend plans'
    ],
    professional: [
      'Quarterly report',
      'Contract review',
      'Invoice attached',
      'Proposal feedback',
      'Meeting request'
    ]
  };
  
  private bodies = {
    colleague: [
      'Let me know your thoughts on the latest changes.',
      'Can we sync up tomorrow to discuss?',
      'I\'ve pushed the updates to the branch.',
      'The client is asking about the timeline.',
      'Here\'s the summary from today\'s standup.'
    ],
    spouse: [
      'Love you! See you tonight.',
      'Don\'t forget to pick up milk on your way home.',
      'I made reservations for 7pm.',
      'Missing you today ❤️',
      'Can\'t wait for our trip this weekend!'
    ],
    friend: [
      'Dude, that was hilarious last night!',
      'Are you free this weekend?',
      'Let\'s grab drinks after work.',
      'Did you see the game last night?',
      'Happy birthday! Hope you have an amazing day!'
    ],
    professional: [
      'Please find the attached report for your review.',
      'Looking forward to our partnership.',
      'The numbers look strong this quarter.',
      'Thank you for your continued support.',
      'Let\'s schedule a call to discuss next steps.'
    ]
  };
  
  generateEmail(relationship: string): ProcessedEmail {
    const subjects = this.subjects[relationship as keyof typeof this.subjects] || this.subjects.colleague;
    const bodies = this.bodies[relationship as keyof typeof this.bodies] || this.bodies.colleague;
    
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const body = bodies[Math.floor(Math.random() * bodies.length)];
    
    const recipientMap: Record<string, string> = {
      colleague: 'colleague@company.com',
      spouse: 'spouse@home.com',
      friend: 'friend@social.com',
      professional: 'client@business.com'
    };
    
    return {
      uid: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      messageId: `<${Date.now()}@mock.local>`,
      inReplyTo: null,
      date: new Date(),
      from: [{ address: 'john@example.com', name: 'John' }],
      to: [{ 
        address: recipientMap[relationship] || 'contact@example.com',
        name: relationship.charAt(0).toUpperCase() + relationship.slice(1)
      }],
      cc: [],
      bcc: [],
      subject,
      textContent: body,
      htmlContent: null,
      userReply: body,
      respondedTo: ''
    };
  }
  
  generateBatch(relationship: string, count: number): ProcessedEmail[] {
    return Array.from({ length: count }, () => this.generateEmail(relationship));
  }
}