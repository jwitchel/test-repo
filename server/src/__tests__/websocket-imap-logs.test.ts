import { ImapLogger } from '../lib/imap-logger';
import { MockImapClient } from '../lib/mock-imap';

describe('WebSocket IMAP Logs Integration', () => {
  let logger: ImapLogger;
  let mockClient: MockImapClient;
  const userId = 'test-user';
  const emailAccountId = 'test-account';

  beforeEach(() => {
    logger = new ImapLogger({ maxLogsPerUser: 100, logLevel: 'debug' });
    mockClient = new MockImapClient(userId, emailAccountId, logger);
  });

  afterEach(() => {
    mockClient.stop();
  });

  describe('real-time log events', () => {
    it('should emit log events for mock operations', (done) => {
      let eventCount = 0;
      
      logger.on('log', (logEntry) => {
        expect(logEntry.userId).toBe(userId);
        expect(logEntry.emailAccountId).toBe(emailAccountId);
        expect(logEntry.id).toBeDefined();
        expect(logEntry.timestamp).toBeDefined();
        
        eventCount++;
        if (eventCount >= 2) { // Command + response
          done();
        }
      });

      mockClient.runOperation({
        name: 'Test Event',
        duration: 10,
        command: 'TEST',
        raw: 'A001 TEST',
        response: 'A001 OK Test completed',
        level: 'info'
      });
    });

    it('should emit user-specific log events', (done) => {
      logger.on(`log:${userId}`, (logEntry) => {
        expect(logEntry.userId).toBe(userId);
        expect(logEntry.command).toBe('USER_SPECIFIC');
        done();
      });

      mockClient.runOperation({
        name: 'User Specific',
        duration: 10,
        command: 'USER_SPECIFIC',
        raw: 'A001 USER_SPECIFIC',
        response: 'A001 OK',
        level: 'info'
      });
    });
  });

  describe('log management', () => {
    it('should accumulate logs from multiple operations', async () => {
      await mockClient.runSequence([
        {
          name: 'Connect',
          duration: 10,
          command: 'CONNECT',
          raw: 'Connecting...',
          response: '* OK Ready',
          level: 'info'
        },
        {
          name: 'Login',
          duration: 10,
          command: 'LOGIN',
          raw: 'A001 LOGIN user@example.com ****',
          response: 'A001 OK Login successful',
          level: 'info'
        }
      ]);

      const logs = logger.getLogs(userId);
      expect(logs.length).toBeGreaterThanOrEqual(4); // 2 operations × 2 logs each
      
      const commands = logs.map(log => log.command);
      expect(commands).toContain('CONNECT');
      expect(commands).toContain('LOGIN');
    });

    it('should clear logs when requested', async () => {
      // Add some logs first
      await mockClient.runOperation({
        name: 'Test',
        duration: 10,
        command: 'TEST',
        response: 'OK',
        level: 'info'
      });

      expect(logger.getLogs(userId).length).toBeGreaterThan(0);

      // Clear logs and verify event is emitted
      let clearEventEmitted = false;
      logger.once('logs-cleared', (data) => {
        expect(data.userId).toBe(userId);
        clearEventEmitted = true;
      });

      logger.clearLogs(userId);
      
      expect(logger.getLogs(userId)).toHaveLength(0);
      expect(clearEventEmitted).toBe(true);
    });
  });

  describe('sanitization in real-time', () => {
    it('should sanitize logs before emitting events', (done) => {
      logger.on('log', (logEntry) => {
        if (logEntry.data.raw) {
          expect(logEntry.data.raw).toContain('****');
          expect(logEntry.data.raw).not.toContain('secretPassword');
          done();
        }
      });

      mockClient.runOperation({
        name: 'Login with Password',
        duration: 10,
        command: 'LOGIN',
        raw: 'A001 LOGIN user@example.com secretPassword',
        level: 'info'
      });
    });

    it('should sanitize parsed objects in events', (done) => {
      logger.on('log', (logEntry) => {
        if (logEntry.data.parsed && logEntry.data.parsed.credentials) {
          expect(logEntry.data.parsed.credentials.password).toBe('****');
          expect(logEntry.data.parsed.credentials.password).not.toBe('actualPassword');
          done();
        }
      });

      logger.log(userId, {
        userId,
        emailAccountId,
        level: 'info',
        command: 'CONFIG',
        data: {
          parsed: {
            credentials: {
              username: 'user@example.com',
              password: 'actualPassword'
            }
          }
        }
      });
    });
  });

  describe('continuous operations', () => {
    it('should handle rapid log generation', async () => {
      const initialLogCount = logger.getLogCount(userId);
      
      // Start continuous operations with short interval
      const continuousPromise = mockClient.runContinuously(50);
      
      // Let it run for 200ms (should generate 3+ operations)
      await new Promise(resolve => setTimeout(resolve, 200));
      
      mockClient.stop();
      await continuousPromise;
      
      const finalLogCount = logger.getLogCount(userId);
      // Each operation generates 2 logs (command + response), so expect at least 2 more
      expect(finalLogCount).toBeGreaterThan(initialLogCount);
    });

    it('should maintain circular buffer during continuous operations', async () => {
      // Create logger with small buffer
      const smallLogger = new ImapLogger({ maxLogsPerUser: 5, logLevel: 'debug' });
      const smallMockClient = new MockImapClient(userId, emailAccountId, smallLogger);
      
      try {
        // Generate many operations
        const continuousPromise = smallMockClient.runContinuously(20);
        
        // Let it run long enough to exceed buffer size
        await new Promise(resolve => setTimeout(resolve, 150));
        
        smallMockClient.stop();
        await continuousPromise;
        
        // Should maintain buffer size limit
        expect(smallLogger.getLogCount(userId)).toBeLessThanOrEqual(5);
        
        // Should have the most recent logs
        const logs = smallLogger.getLogs(userId);
        expect(logs.length).toBeGreaterThan(0);
        expect(logs.length).toBeLessThanOrEqual(5);
      } finally {
        smallMockClient.stop();
      }
    });
  });
});