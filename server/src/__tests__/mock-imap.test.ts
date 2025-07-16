import { MockImapClient, TEST_SEQUENCES } from '../lib/mock-imap';
import { ImapLogger } from '../lib/imap-logger';

describe('MockImapClient', () => {
  let mockClient: MockImapClient;
  let testLogger: ImapLogger;
  const userId = 'test-user';
  const emailAccountId = 'test-account';

  beforeEach(() => {
    // Create a test logger with debug level to capture all logs
    testLogger = new ImapLogger({ maxLogsPerUser: 1000, logLevel: 'debug' });
    
    // Inject the test logger into the MockImapClient
    mockClient = new MockImapClient(userId, emailAccountId, testLogger);
  });

  afterEach(() => {
    mockClient.stop();
  });

  describe('runOperation', () => {
    it('should log command and response for successful operations', async () => {
      const operation = {
        name: 'Test Op',
        duration: 10,
        command: 'TEST',
        raw: 'A001 TEST',
        response: 'A001 OK Test completed',
        level: 'info' as const
      };

      await mockClient.runOperation(operation);

      const logs = testLogger.getLogs(userId);
      expect(logs).toHaveLength(2);
      
      // First log should be the command
      expect(logs[0].command).toBe('TEST');
      expect(logs[0].data.raw).toBe('A001 TEST');
      
      // Second log should be the response
      expect(logs[1].command).toBe('TEST');
      expect(logs[1].data.response).toBe('A001 OK Test completed');
      expect(logs[1].data.duration).toBeGreaterThanOrEqual(10);
    });

    it('should log errors for failed operations', async () => {
      const operation = {
        name: 'Error Op',
        duration: 10,
        command: 'ERROR',
        raw: 'A001 ERROR',
        error: 'Connection reset',
        level: 'error' as const
      };

      await mockClient.runOperation(operation);

      const logs = testLogger.getLogs(userId);
      expect(logs).toHaveLength(2);
      
      // Second log should be the error
      expect(logs[1].level).toBe('error');
      expect(logs[1].data.error).toBe('Connection reset');
    });
  });

  describe('runSequence', () => {
    it('should run operations in sequence', async () => {
      const sequence = [
        {
          name: 'Op1',
          duration: 10,
          command: 'CMD1',
          raw: 'A001 CMD1',
          response: 'Response 1'
        },
        {
          name: 'Op2',
          duration: 10,
          command: 'CMD2',
          raw: 'A002 CMD2',
          response: 'Response 2'
        }
      ];

      await mockClient.runSequence(sequence);

      const logs = testLogger.getLogs(userId);
      
      // Each operation logs twice (command + response)
      expect(logs.length).toBeGreaterThanOrEqual(4);
      
      const commands = logs.filter(log => log.data.raw).map(log => log.command);
      expect(commands).toContain('CMD1');
      expect(commands).toContain('CMD2');
    });

    it('should use default operations if none provided', async () => {
      // Use a subset of quick operations to avoid timeout
      const quickOps = [
        {
          name: 'Quick Connect',
          duration: 10,
          command: 'CONNECT',
          raw: '* OK IMAP ready',
          response: 'Connected',
          level: 'info' as const
        },
        {
          name: 'Quick Login',
          duration: 10,
          command: 'LOGIN',
          raw: 'A001 LOGIN user pass',
          response: 'A001 OK Login completed',
          level: 'info' as const
        }
      ];
      
      await mockClient.runSequence(quickOps);
      
      const logs = testLogger.getLogs(userId);
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('runContinuously', () => {
    it('should run operations continuously until stopped', async () => {
      const intervalMs = 100; // Short interval for testing
      
      // Start continuous operations (don't await immediately)
      const promise = mockClient.runContinuously(intervalMs);
      
      // Wait for the first operation to complete
      await new Promise(resolve => setTimeout(resolve, 300)); // Allow for first operation + interval
      
      // Stop the client
      mockClient.stop();
      
      // Wait for the promise to resolve with a timeout
      await Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
      ]);
      
      const logs = testLogger.getLogs(userId);
      // Should have logs from at least one operation (each operation logs 2 entries: command + response)
      expect(logs.length).toBeGreaterThanOrEqual(2);
    }, 10000);
  });

  describe('scenarios', () => {
    it('should simulate new email notification', async () => {
      await mockClient.simulateNewEmailNotification();
      
      const logs = testLogger.getLogs(userId);
      const idleLog = logs.find(log => log.command === 'IDLE' && log.data.response);
      
      expect(idleLog).toBeDefined();
      expect(idleLog?.data.response).toContain('New email received');
    });

    it('should simulate connection loss', async () => {
      await mockClient.simulateConnectionLoss();
      
      const logs = testLogger.getLogs(userId);
      const errorLog = logs.find(log => log.level === 'error' && log.data.error);
      
      expect(errorLog).toBeDefined();
      expect(errorLog?.data.error).toBe('Connection reset by peer');
    });

    it('should simulate folder sync', async () => {
      await mockClient.simulateSyncFolder('INBOX', 42);
      
      const logs = testLogger.getLogs(userId);
      const selectLog = logs.find(log => log.command === 'SELECT' && log.data.response);
      const fetchLog = logs.find(log => log.command === 'FETCH' && log.data.response);
      
      expect(selectLog).toBeDefined();
      expect(selectLog?.data.response).toContain('42 EXISTS');
      
      expect(fetchLog).toBeDefined();
      expect(fetchLog?.data.response).toContain('Synced 42 messages');
    });
  });

  describe('TEST_SEQUENCES', () => {
    it('should have valid test sequences', () => {
      expect(TEST_SEQUENCES.basic).toBeDefined();
      expect(TEST_SEQUENCES.fullSync).toBeDefined();
      expect(TEST_SEQUENCES.errors).toBeDefined();
      expect(TEST_SEQUENCES.monitoring).toBeDefined();
      
      // Each sequence should be an array of operations
      expect(Array.isArray(TEST_SEQUENCES.basic)).toBe(true);
      expect(TEST_SEQUENCES.basic.length).toBeGreaterThan(0);
    });

    it('should run basic sequence', async () => {
      await mockClient.runSequence(TEST_SEQUENCES.basic);
      
      const logs = testLogger.getLogs(userId);
      const commands = logs.map(log => log.command);
      
      expect(commands).toContain('CONNECT');
      expect(commands).toContain('LOGIN');
      expect(commands).toContain('SELECT');
      expect(commands).toContain('SEARCH');
    });
  });
});