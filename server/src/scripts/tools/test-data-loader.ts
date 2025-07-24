// Mock TestDataLoader for tests
export class TestDataLoader {
  async initialize(): Promise<void> {
    // Mock initialization
  }

  async loadEmailData(): Promise<any[]> {
    // Return mock email data
    return [
      {
        id: 'test-email-1',
        subject: 'Test Email',
        body: 'This is a test email',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        date: new Date().toISOString()
      }
    ];
  }

  async cleanup(): Promise<void> {
    // Mock cleanup
  }
}