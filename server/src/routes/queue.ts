import express from 'express';
import { requireAuth } from '../middleware/auth';
import {
  inboxQueue,
  trainingQueue
} from '../lib/queue';

const router = express.Router();

// Get queue health status
router.get('/health', requireAuth, async (_req, res): Promise<void> => {
  try {
    const inboxCounts = await inboxQueue.getJobCounts();
    const trainingCounts = await trainingQueue.getJobCounts();

    res.json({
      status: 'healthy',
      queues: {
        'inbox': {
          ...inboxCounts,
          isPaused: await inboxQueue.isPaused()
        },
        'training': {
          ...trainingCounts,
          isPaused: await trainingQueue.isPaused()
        }
      }
    });
  } catch (error) {
    console.error('Error getting queue health:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get queue statistics
router.get('/stats', requireAuth, async (_req, res): Promise<void> => {
  try {
    const emailCounts = await inboxQueue.getJobCounts();
    const toneCounts = await trainingQueue.getJobCounts();
    
    res.json({
      'email-processing': emailCounts,
      'tone-profile': toneCounts
    });
  } catch (error) {
    console.error('Error getting queue stats:', error);
    res.status(500).json({
      error: 'Failed to get queue statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;