import { RealTimeLogger } from '../lib/real-time-logger';

describe('RealTimeLogger', () => {
  let logger: RealTimeLogger;

  beforeEach(() => {
    logger = new RealTimeLogger({ maxLogsPerUser: 5, logLevel: 'debug' });
  });

  describe('log levels', () => {
    it('should log entries at or above the configured log level', () => {
      const logger = new RealTimeLogger({ logLevel: 'info' });
      const userId = 'test-user';
      
      logger.log(userId, {
        userId,
        emailAccountId: 'account-1',
        level: 'debug',
        command: 'DEBUG_CMD',
        data: {}
      });
      
      logger.log(userId, {
        userId,
        emailAccountId: 'account-1',
        level: 'info',
        command: 'INFO_CMD',
        data: {}
      });
      
      logger.log(userId, {
        userId,
        emailAccountId: 'account-1',
        level: 'error',
        command: 'ERROR_CMD',
        data: {}
      });
      
      const logs = logger.getLogs(userId);
      expect(logs).toHaveLength(2);
      expect(logs[0].command).toBe('INFO_CMD');
      expect(logs[1].command).toBe('ERROR_CMD');
    });
  });

  describe('circular buffer', () => {
    it('should maintain a circular buffer of logs per user', () => {
      const userId = 'test-user';
      
      // Add 7 logs (more than maxLogsPerUser of 5)
      for (let i = 1; i <= 7; i++) {
        logger.log(userId, {
          userId,
          emailAccountId: 'account-1',
          level: 'info',
          command: `CMD_${i}`,
          data: {}
        });
      }
      
      const logs = logger.getLogs(userId);
      expect(logs).toHaveLength(5);
      expect(logs[0].command).toBe('CMD_3'); // Oldest kept
      expect(logs[4].command).toBe('CMD_7'); // Newest
    });
  });

  describe('sanitization', () => {
    it('should sanitize passwords in LOGIN commands', () => {
      const userId = 'test-user';
      
      logger.log(userId, {
        userId,
        emailAccountId: 'account-1',
        level: 'info',
        command: 'LOGIN',
        data: {
          raw: 'A001 LOGIN user@example.com mySecretPassword123',
          response: 'A001 OK LOGIN completed'
        }
      });
      
      const logs = logger.getLogs(userId);
      expect(logs[0].data.raw).toBe('A001 LOGIN user@example.com ****');
      expect(logs[0].data.raw).not.toContain('mySecretPassword123');
    });

    it('should sanitize passwords in AUTHENTICATE commands', () => {
      const userId = 'test-user';
      
      logger.log(userId, {
        userId,
        emailAccountId: 'account-1',
        level: 'info',
        command: 'AUTHENTICATE',
        data: {
          raw: 'A002 AUTHENTICATE PLAIN dXNlckBleGFtcGxlLmNvbQB1c2VyQGV4YW1wbGUuY29tAHBhc3N3b3Jk'
        }
      });
      
      const logs = logger.getLogs(userId);
      expect(logs[0].data.raw).toContain('AUTHENTICATE PLAIN ****');
      expect(logs[0].data.raw).not.toContain('dXNlckBleGFtcGxlLmNvbQB1c2VyQGV4YW1wbGUuY29tAHBhc3N3b3Jk');
    });

    it('should sanitize message content in FETCH responses', () => {
      const userId = 'test-user';
      
      logger.log(userId, {
        userId,
        emailAccountId: 'account-1',
        level: 'info',
        command: 'FETCH',
        data: {
          response: '* 1 FETCH (BODY[] {1234}\nFrom: sender@example.com\nTo: recipient@example.com\nSubject: Test\n\nThis is the email body content that should be redacted.\n)'
        }
      });
      
      const logs = logger.getLogs(userId);
      expect(logs[0].data.response).toContain('[MESSAGE CONTENT REDACTED]');
      expect(logs[0].data.response).not.toContain('This is the email body content');
    });

    it('should sanitize password fields in parsed objects', () => {
      const userId = 'test-user';
      
      logger.log(userId, {
        userId,
        emailAccountId: 'account-1',
        level: 'info',
        command: 'CONFIG',
        data: {
          parsed: {
            username: 'user@example.com',
            password: 'secretPassword123',
            imap_password: 'anotherSecret',
            auth_token: 'Bearer abc123',
            host: 'imap.example.com'
          }
        }
      });
      
      const logs = logger.getLogs(userId);
      const parsed = logs[0].data.parsed;
      expect(parsed.username).toBe('user@example.com');
      expect(parsed.password).toBe('****');
      expect(parsed.imap_password).toBe('****');
      expect(parsed.auth_token).toBe('****');
      expect(parsed.host).toBe('imap.example.com');
    });
  });

  describe('getLogs', () => {
    it('should return logs for a specific user', () => {
      logger.log('user1', {
        userId: 'user1',
        emailAccountId: 'account-1',
        level: 'info',
        command: 'CMD1',
        data: {}
      });
      
      logger.log('user2', {
        userId: 'user2',
        emailAccountId: 'account-2',
        level: 'info',
        command: 'CMD2',
        data: {}
      });
      
      const user1Logs = logger.getLogs('user1');
      const user2Logs = logger.getLogs('user2');
      
      expect(user1Logs).toHaveLength(1);
      expect(user1Logs[0].command).toBe('CMD1');
      expect(user2Logs).toHaveLength(1);
      expect(user2Logs[0].command).toBe('CMD2');
    });

    it('should return empty array for unknown user', () => {
      const logs = logger.getLogs('unknown-user');
      expect(logs).toEqual([]);
    });

    it('should limit returned logs when limit is specified', () => {
      const userId = 'test-user';
      
      for (let i = 1; i <= 5; i++) {
        logger.log(userId, {
          userId,
          emailAccountId: 'account-1',
          level: 'info',
          command: `CMD_${i}`,
          data: {}
        });
      }
      
      const logs = logger.getLogs(userId, 3);
      expect(logs).toHaveLength(3);
      expect(logs[0].command).toBe('CMD_3'); // Last 3 logs
      expect(logs[2].command).toBe('CMD_5');
    });
  });

  describe('clearLogs', () => {
    it('should clear logs for a specific user', () => {
      const userId = 'test-user';
      
      logger.log(userId, {
        userId,
        emailAccountId: 'account-1',
        level: 'info',
        command: 'CMD1',
        data: {}
      });
      
      expect(logger.getLogs(userId)).toHaveLength(1);
      
      logger.clearLogs(userId);
      
      expect(logger.getLogs(userId)).toHaveLength(0);
    });
  });

  describe('getLogCount', () => {
    it('should return the correct log count for a user', () => {
      const userId = 'test-user';
      
      expect(logger.getLogCount(userId)).toBe(0);
      
      logger.log(userId, {
        userId,
        emailAccountId: 'account-1',
        level: 'info',
        command: 'CMD1',
        data: {}
      });
      
      expect(logger.getLogCount(userId)).toBe(1);
      
      logger.log(userId, {
        userId,
        emailAccountId: 'account-1',
        level: 'info',
        command: 'CMD2',
        data: {}
      });
      
      expect(logger.getLogCount(userId)).toBe(2);
    });
  });

  describe('events', () => {
    it('should emit log events', (done) => {
      const userId = 'test-user';
      const logEntry = {
        userId,
        emailAccountId: 'account-1',
        level: 'info' as const,
        command: 'TEST',
        data: { raw: 'test data' }
      };
      
      logger.once('log', (emittedLog) => {
        expect(emittedLog.userId).toBe(userId);
        expect(emittedLog.command).toBe('TEST');
        expect(emittedLog.id).toBeDefined();
        expect(emittedLog.timestamp).toBeDefined();
        done();
      });
      
      logger.log(userId, logEntry);
    });

    it('should emit user-specific log events', (done) => {
      const userId = 'test-user';
      const logEntry = {
        userId,
        emailAccountId: 'account-1',
        level: 'info' as const,
        command: 'TEST',
        data: {}
      };
      
      logger.once(`log:${userId}`, (emittedLog) => {
        expect(emittedLog.userId).toBe(userId);
        expect(emittedLog.command).toBe('TEST');
        done();
      });
      
      logger.log(userId, logEntry);
    });

    it('should emit logs-cleared event', (done) => {
      const userId = 'test-user';
      
      logger.once('logs-cleared', (data) => {
        expect(data.userId).toBe(userId);
        done();
      });
      
      logger.clearLogs(userId);
    });
  });
});