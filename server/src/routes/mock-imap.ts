import express from 'express';
import { requireAuth } from '../middleware/auth';
import { MockImapClient, TEST_SEQUENCES } from '../lib/mock-imap';
import { imapLogger } from '../lib/imap-logger';

const router = express.Router();

// Store active mock clients
const activeMockClients = new Map<string, MockImapClient>();


// Start continuous mock operations
router.post('/start', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { emailAccountId, interval = 2000 } = req.body;

    if (!emailAccountId) {
      res.status(400).json({ error: 'emailAccountId is required' });
      return;
    }

    // Check if already running
    const clientKey = `${userId}-${emailAccountId}`;
    if (activeMockClients.has(clientKey)) {
      res.status(409).json({ error: 'Mock operations already running for this account' });
      return;
    }

    // Create and start mock client
    const mockClient = new MockImapClient(userId, emailAccountId);
    activeMockClients.set(clientKey, mockClient);

    // Start continuous operations in background
    mockClient.runContinuously(interval).catch(error => {
      console.error('Mock IMAP error:', error);
      activeMockClients.delete(clientKey);
    });

    // Log the start
    console.log(`Starting mock operations for user ${userId}, account ${emailAccountId}`);
    imapLogger.log(userId, {
      userId,
      emailAccountId,
      level: 'info',
      command: 'MOCK_START',
      data: {
        parsed: { message: 'Started mock IMAP operations', interval }
      }
    });

    res.json({ 
      message: 'Mock IMAP operations started',
      interval,
      emailAccountId 
    });
  } catch (error) {
    console.error('Error starting mock operations:', error);
    res.status(500).json({ error: 'Failed to start mock operations' });
  }
});

// Stop mock operations
router.post('/stop', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { emailAccountId } = req.body;

    if (!emailAccountId) {
      res.status(400).json({ error: 'emailAccountId is required' });
      return;
    }

    const clientKey = `${userId}-${emailAccountId}`;
    const mockClient = activeMockClients.get(clientKey);

    if (!mockClient) {
      res.status(404).json({ error: 'No active mock operations for this account' });
      return;
    }

    // Stop and remove client
    mockClient.stop();
    activeMockClients.delete(clientKey);

    // Log the stop
    imapLogger.log(userId, {
      userId,
      emailAccountId,
      level: 'info',
      command: 'MOCK_STOP',
      data: {
        parsed: { message: 'Stopped mock IMAP operations' }
      }
    });

    res.json({ message: 'Mock IMAP operations stopped' });
  } catch (error) {
    console.error('Error stopping mock operations:', error);
    res.status(500).json({ error: 'Failed to stop mock operations' });
  }
});

// Run a specific sequence
router.post('/sequence', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { emailAccountId, sequence = 'basic' } = req.body;

    if (!emailAccountId) {
      res.status(400).json({ error: 'emailAccountId is required' });
      return;
    }

    if (!TEST_SEQUENCES[sequence as keyof typeof TEST_SEQUENCES]) {
      res.status(400).json({ error: 'Invalid sequence name' });
      return;
    }

    // Create temporary client for sequence
    const mockClient = new MockImapClient(userId, emailAccountId);
    
    // Log sequence start
    console.log(`Running ${sequence} sequence for user ${userId}, account ${emailAccountId}`);
    imapLogger.log(userId, {
      userId,
      emailAccountId,
      level: 'info',
      command: 'MOCK_SEQUENCE',
      data: {
        parsed: { message: `Starting ${sequence} sequence` }
      }
    });

    // Run the sequence
    const operations = TEST_SEQUENCES[sequence as keyof typeof TEST_SEQUENCES];
    await mockClient.runSequence(operations);

    res.json({ 
      message: `Completed ${sequence} sequence`,
      operationCount: operations.length 
    });
  } catch (error) {
    console.error('Error running sequence:', error);
    res.status(500).json({ error: 'Failed to run sequence' });
  }
});

// Run specific scenarios
router.post('/scenario', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { emailAccountId, scenario, folderName, messageCount } = req.body;

    if (!emailAccountId || !scenario) {
      res.status(400).json({ error: 'emailAccountId and scenario are required' });
      return;
    }

    // Create temporary client for scenario
    const mockClient = new MockImapClient(userId, emailAccountId);

    switch (scenario) {
      case 'new-email':
        await mockClient.simulateNewEmailNotification();
        res.json({ message: 'Simulated new email notification' });
        break;

      case 'connection-loss':
        await mockClient.simulateConnectionLoss();
        res.json({ message: 'Simulated connection loss' });
        break;

      case 'sync-folder':
        if (!folderName || !messageCount) {
          res.status(400).json({ 
            error: 'folderName and messageCount are required for sync-folder scenario' 
          });
          return;
        }
        await mockClient.simulateSyncFolder(folderName, messageCount);
        res.json({ 
          message: `Simulated sync of ${folderName} with ${messageCount} messages` 
        });
        break;

      case 'process-email':
        await mockClient.simulateEmailProcessing();
        res.json({ 
          message: 'Simulated email processing with text extraction' 
        });
        break;

      default:
        res.status(400).json({ error: 'Invalid scenario' });
        return;
    }
  } catch (error) {
    console.error('Error running scenario:', error);
    res.status(500).json({ error: 'Failed to run scenario' });
  }
});

// Get active mock clients
router.get('/status', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    
    const userClients = Array.from(activeMockClients.keys())
      .filter(key => key.startsWith(`${userId}-`))
      .map(key => {
        const emailAccountId = key.substring(userId.length + 1);
        return { emailAccountId, active: true };
      });

    res.json({ 
      mockClients: userClients,
      total: userClients.length 
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Clear logs for testing
router.post('/clear-logs', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    imapLogger.clearLogs(userId);
    res.json({ message: 'Logs cleared' });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// Cleanup on server shutdown
export function stopAllMockClients(): void {
  for (const [, client] of activeMockClients) {
    client.stop();
  }
  activeMockClients.clear();
  console.log('Stopped all mock IMAP clients');
}

export default router;