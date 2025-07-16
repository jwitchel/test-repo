import { ImapConnection, ImapConfig } from '../lib/imap-connection';
import { ImapOperations } from '../lib/imap-operations';
import { encryptPassword } from '../lib/crypto';

// Test configuration for Docker test email server
const TEST_CONFIG: ImapConfig = {
  user: 'user1@testmail.local',
  password: 'testpass123',
  host: 'localhost',
  port: 1143, // Non-SSL IMAP port for test server
  tls: false,
  authTimeout: 5000,
  connTimeout: 5000
};

const TEST_ACCOUNT = {
  id: 'test-account-1',
  userId: 'test-user-1',
  email: 'user1@testmail.local',
  imapHost: 'localhost',
  imapPort: 1143,
  imapUsername: 'user1@testmail.local',
  imapPasswordEncrypted: encryptPassword('testpass123'),
  imapSecure: false
};

describe('ImapConnection', () => {
  let connection: ImapConnection;

  beforeEach(() => {
    connection = new ImapConnection(TEST_CONFIG, 'test-user-1', 'test-account-1');
  });

  afterEach(async () => {
    if (connection.isConnected()) {
      await connection.disconnect();
    }
  });

  describe('connect', () => {
    it('should connect to test email server', async () => {
      await connection.connect();
      expect(connection.isConnected()).toBe(true);
    }, 10000);

    it('should fail with invalid credentials', async () => {
      const badConnection = new ImapConnection(
        { ...TEST_CONFIG, password: 'wrongpassword' },
        'test-user-1',
        'test-account-1'
      );

      await expect(badConnection.connect()).rejects.toThrow();
      expect(badConnection.isConnected()).toBe(false);
    }, 10000);

    it('should fail with invalid host', async () => {
      const badConnection = new ImapConnection(
        { ...TEST_CONFIG, host: 'invalid.host.local' },
        'test-user-1',
        'test-account-1'
      );

      await expect(badConnection.connect()).rejects.toThrow();
      expect(badConnection.isConnected()).toBe(false);
    }, 10000);
  });

  describe('listFolders', () => {
    it('should list folders after connecting', async () => {
      await connection.connect();
      const folders = await connection.listFolders();

      expect(folders).toBeInstanceOf(Array);
      expect(folders.length).toBeGreaterThan(0);
      
      // Check for standard folders
      const folderNames = folders.map(f => f.name);
      expect(folderNames).toContain('INBOX');
    }, 10000);

    it('should fail when not connected', async () => {
      await expect(connection.listFolders()).rejects.toThrow('Not connected');
    });
  });

  describe('selectFolder', () => {
    it('should select INBOX', async () => {
      await connection.connect();
      const box = await connection.selectFolder('INBOX');

      expect(box).toBeDefined();
      expect(box.messages).toBeDefined();
      expect(connection.getCurrentFolder()).toBe('INBOX');
    }, 10000);

    it('should fail with invalid folder', async () => {
      await connection.connect();
      await expect(connection.selectFolder('INVALID_FOLDER')).rejects.toThrow();
    }, 10000);
  });

  describe('search', () => {
    it('should search for all messages', async () => {
      await connection.connect();
      await connection.selectFolder('INBOX');
      
      const uids = await connection.search(['ALL']);
      expect(uids).toBeInstanceOf(Array);
    }, 10000);

    it('should search for unseen messages', async () => {
      await connection.connect();
      await connection.selectFolder('INBOX');
      
      const uids = await connection.search(['UNSEEN']);
      expect(uids).toBeInstanceOf(Array);
    }, 10000);
  });

  describe('disconnect', () => {
    it('should disconnect properly', async () => {
      await connection.connect();
      expect(connection.isConnected()).toBe(true);

      await connection.disconnect();
      expect(connection.isConnected()).toBe(false);
    }, 10000);

    it('should handle multiple disconnect calls', async () => {
      await connection.connect();
      await connection.disconnect();
      await connection.disconnect(); // Should not throw
      
      expect(connection.isConnected()).toBe(false);
    }, 10000);
  });
});

describe('ImapOperations', () => {
  let imapOps: ImapOperations;

  beforeEach(() => {
    imapOps = new ImapOperations(TEST_ACCOUNT);
  });

  afterEach(() => {
    imapOps.release();
  });

  describe('testConnection', () => {
    it('should successfully test connection', async () => {
      const result = await imapOps.testConnection();
      expect(result).toBe(true);
    }, 10000);

    it('should fail with invalid credentials', async () => {
      const badOps = new ImapOperations({
        ...TEST_ACCOUNT,
        imapPasswordEncrypted: encryptPassword('wrongpassword')
      });

      const result = await badOps.testConnection();
      expect(result).toBe(false);
    }, 10000);
  });

  describe('getFolders', () => {
    it('should get folders with message counts', async () => {
      const folders = await imapOps.getFolders();

      expect(folders).toBeInstanceOf(Array);
      expect(folders.length).toBeGreaterThan(0);

      const inbox = folders.find(f => f.name === 'INBOX');
      expect(inbox).toBeDefined();
      expect(inbox?.messageCount).toBeDefined();
    }, 10000);
  });

  describe('getMessages', () => {
    it('should get messages from INBOX', async () => {
      const messages = await imapOps.getMessages('INBOX', {
        limit: 10,
        offset: 0
      });

      expect(messages).toBeInstanceOf(Array);
      
      if (messages.length > 0) {
        const msg = messages[0];
        expect(msg.uid).toBeDefined();
        expect(msg.flags).toBeInstanceOf(Array);
      }
    }, 10000);

    it('should respect pagination', async () => {
      const page1 = await imapOps.getMessages('INBOX', {
        limit: 5,
        offset: 0
      });

      const page2 = await imapOps.getMessages('INBOX', {
        limit: 5,
        offset: 5
      });

      // Pages should not overlap
      if (page1.length > 0 && page2.length > 0) {
        const page1Uids = page1.map(m => m.uid);
        const page2Uids = page2.map(m => m.uid);
        
        const overlap = page1Uids.filter(uid => page2Uids.includes(uid));
        expect(overlap.length).toBe(0);
      }
    }, 10000);
  });

  describe('searchMessages', () => {
    it('should search for unseen messages', async () => {
      const messages = await imapOps.searchMessages('INBOX', {
        unseen: true
      });

      expect(messages).toBeInstanceOf(Array);
      
      // All returned messages should not have the \Seen flag
      for (const msg of messages) {
        expect(msg.flags).not.toContain('\\Seen');
      }
    }, 10000);

    it('should search with multiple criteria', async () => {
      const messages = await imapOps.searchMessages('INBOX', {
        seen: true,
        since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      });

      expect(messages).toBeInstanceOf(Array);
    }, 10000);
  });
});