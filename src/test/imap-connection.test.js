// src/test/imap-connection.test.js
const { TestMailServer } = require('./imap-test-utils');

describe('IMAP Connection Tests', () => {
  const testServer = new TestMailServer();
  
  test('should connect to test IMAP server', async () => {
    const imap = await testServer.createTestConnection(
      'user1@testmail.local',
      'testpass123'
    );
    
    await new Promise((resolve, reject) => {
      imap.once('ready', resolve);
      imap.once('error', reject);
      imap.connect();
    });
    
    expect(imap.state).toBe('authenticated');
    imap.end();
  });
  
  test('should create draft in AI-Ready folder', async () => {
    const imap = await testServer.createTestConnection(
      'user1@testmail.local',
      'testpass123'
    );
    
    // Test draft creation
    const draft = {
      to: 'user2@testmail.local',
      subject: 'Test Draft',
      body: 'This is a test draft'
    };
    
    const result = await testServer.createDraft(imap, draft);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Draft created successfully');
    
    imap.end();
  });
});