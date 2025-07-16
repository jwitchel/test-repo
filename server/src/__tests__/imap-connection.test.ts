import { ImapConnection, ImapConfig } from '../lib/imap-connection';

// Mock the crypto module to avoid ENCRYPTION_KEY requirement
jest.mock('../lib/crypto', () => ({
  encryptPassword: (password: string) => Buffer.from(password).toString('base64'),
  decryptPassword: (encrypted: string) => Buffer.from(encrypted, 'base64').toString()
}));

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

describe('ImapConnection', () => {

  describe('connect', () => {
    it('should connect to test email server', async () => {
      const connection = new ImapConnection(TEST_CONFIG, 'test-user-1', 'test-account-1');
      
      try {
        await connection.connect();
        expect(connection.isConnected()).toBe(true);
      } finally {
        if (connection.isConnected()) {
          await connection.disconnect();
        }
      }
    }, 10000);

    it('should fail with invalid credentials', async () => {
      const badConnection = new ImapConnection(
        { ...TEST_CONFIG, password: 'wrongpassword' },
        'test-user-1',
        'test-account-1'
      );

      // Handle the unhandled error event
      badConnection.on('error', () => {
        // Ignore errors during this test
      });

      await expect(badConnection.connect()).rejects.toThrow();
      expect(badConnection.isConnected()).toBe(false);
    }, 10000);

    it('should fail with invalid host', async () => {
      const badConnection = new ImapConnection(
        { ...TEST_CONFIG, host: 'invalid.host.local' },
        'test-user-1',
        'test-account-1'
      );

      // Handle error events to prevent unhandled errors
      badConnection.on('error', () => {
        // Ignore errors during this test
      });

      await expect(badConnection.connect()).rejects.toThrow();
      expect(badConnection.isConnected()).toBe(false);
    }, 10000);
  });

  describe('listFolders', () => {
    it('should list folders after connecting', async () => {
      const connection = new ImapConnection(TEST_CONFIG, 'test-user-1', 'test-account-1');
      
      try {
        await connection.connect();
        const folders = await connection.listFolders();

        expect(folders).toBeInstanceOf(Array);
        expect(folders.length).toBeGreaterThan(0);
        
        // Check for standard folders
        const folderNames = folders.map(f => f.name);
        expect(folderNames).toContain('INBOX');
      } finally {
        if (connection.isConnected()) {
          await connection.disconnect();
        }
      }
    }, 10000);

    it('should fail when not connected', async () => {
      const connection = new ImapConnection(TEST_CONFIG, 'test-user-1', 'test-account-1');
      await expect(connection.listFolders()).rejects.toThrow('Not connected');
    });
  });

  describe('selectFolder', () => {
    it('should select INBOX', async () => {
      const connection = new ImapConnection(TEST_CONFIG, 'test-user-1', 'test-account-1');
      
      try {
        await connection.connect();
        const box = await connection.selectFolder('INBOX');

        expect(box).toBeDefined();
        expect(box.messages).toBeDefined();
        expect(connection.getCurrentFolder()).toBe('INBOX');
      } finally {
        if (connection.isConnected()) {
          await connection.disconnect();
        }
      }
    }, 10000);

    it('should fail with invalid folder', async () => {
      const connection = new ImapConnection(TEST_CONFIG, 'test-user-1', 'test-account-1');
      
      try {
        await connection.connect();
        await expect(connection.selectFolder('INVALID_FOLDER')).rejects.toThrow();
      } finally {
        if (connection.isConnected()) {
          await connection.disconnect();
        }
      }
    }, 10000);
  });

  describe('search', () => {
    it('should search for all messages', async () => {
      const connection = new ImapConnection(TEST_CONFIG, 'test-user-1', 'test-account-1');
      
      try {
        await connection.connect();
        await connection.selectFolder('INBOX');
        
        const uids = await connection.search(['ALL']);
        expect(uids).toBeInstanceOf(Array);
      } finally {
        if (connection.isConnected()) {
          await connection.disconnect();
        }
      }
    }, 10000);

    it('should search for unseen messages', async () => {
      const connection = new ImapConnection(TEST_CONFIG, 'test-user-1', 'test-account-1');
      
      try {
        await connection.connect();
        await connection.selectFolder('INBOX');
        
        const uids = await connection.search(['UNSEEN']);
        expect(uids).toBeInstanceOf(Array);
      } finally {
        if (connection.isConnected()) {
          await connection.disconnect();
        }
      }
    }, 10000);
  });

  describe('disconnect', () => {
    it('should disconnect properly', async () => {
      const connection = new ImapConnection(TEST_CONFIG, 'test-user-1', 'test-account-1');
      
      await connection.connect();
      expect(connection.isConnected()).toBe(true);

      await connection.disconnect();
      expect(connection.isConnected()).toBe(false);
    }, 10000);

    it('should handle multiple disconnect calls', async () => {
      const connection = new ImapConnection(TEST_CONFIG, 'test-user-1', 'test-account-1');
      
      await connection.connect();
      await connection.disconnect();
      await connection.disconnect(); // Should not throw
      
      expect(connection.isConnected()).toBe(false);
    }, 10000);
  });
});

