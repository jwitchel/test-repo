import express from 'express';
import { requireAuth } from '../middleware/auth';
import { 
  emailProcessingQueue,
  toneProfileQueue
} from '../lib/queue';

const router = express.Router();

// Get queue health status
router.get('/health', requireAuth, async (_req, res): Promise<void> => {
  try {
    const emailCounts = await emailProcessingQueue.getJobCounts();
    const toneCounts = await toneProfileQueue.getJobCounts();
    
    res.json({
      status: 'healthy',
      queues: {
        'email-processing': {
          ...emailCounts,
          isPaused: await emailProcessingQueue.isPaused()
        },
        'tone-profile': {
          ...toneCounts,
          isPaused: await toneProfileQueue.isPaused()
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
    const emailCounts = await emailProcessingQueue.getJobCounts();
    const toneCounts = await toneProfileQueue.getJobCounts();
    
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