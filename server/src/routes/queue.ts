import express from 'express';
import { requireAuth } from '../middleware/auth';
import { 
  addEmailJob, 
  addToneProfileJob, 
  getQueueStats, 
  monitorQueueHealth,
  emailProcessingQueue,
  toneProfileQueue,
  JobType,
  JobPriority
} from '../lib/queue';

const router = express.Router();

// Get queue health status
router.get('/health', requireAuth, async (_req, res): Promise<void> => {
  try {
    const health = await monitorQueueHealth();
    res.json(health);
  } catch (error) {
    console.error('Error getting queue health:', error);
    res.status(500).json({
      error: 'Failed to get queue health',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get queue statistics
router.get('/stats', requireAuth, async (_req, res): Promise<void> => {
  try {
    const [emailStats, toneStats] = await Promise.all([
      getQueueStats(emailProcessingQueue),
      getQueueStats(toneProfileQueue)
    ]);

    res.json({
      emailProcessing: emailStats,
      toneProfile: toneStats
    });
  } catch (error) {
    console.error('Error getting queue stats:', error);
    res.status(500).json({
      error: 'Failed to get queue statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Trigger inbox monitoring for an account
router.post('/monitor-inbox', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { accountId, folderName = 'INBOX' } = req.body;

    if (!accountId) {
      res.status(400).json({ error: 'accountId is required' });
      return;
    }

    const job = await addEmailJob(
      JobType.MONITOR_INBOX,
      {
        userId,
        accountId,
        folderName
      },
      JobPriority.NORMAL
    );

    res.json({
      success: true,
      jobId: job.id,
      message: 'Inbox monitoring job queued'
    });
  } catch (error) {
    console.error('Error queueing monitor inbox job:', error);
    res.status(500).json({
      error: 'Failed to queue job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Build tone profile for a user
router.post('/build-tone-profile', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { accountId, historyDays = 30 } = req.body;

    if (!accountId) {
      res.status(400).json({ error: 'accountId is required' });
      return;
    }

    const job = await addToneProfileJob(
      {
        userId,
        accountId,
        historyDays
      },
      JobPriority.NORMAL
    );

    res.json({
      success: true,
      jobId: job.id,
      message: 'Tone profile build job queued'
    });
  } catch (error) {
    console.error('Error queueing tone profile job:', error);
    res.status(500).json({
      error: 'Failed to queue job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Process a specific email
router.post('/process-email', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { accountId, emailUid, folderName = 'INBOX', priority = 'normal' } = req.body;

    if (!accountId || !emailUid) {
      res.status(400).json({ error: 'accountId and emailUid are required' });
      return;
    }

    // Map priority string to enum
    const priorityMap: Record<string, JobPriority> = {
      'critical': JobPriority.CRITICAL,
      'high': JobPriority.HIGH,
      'normal': JobPriority.NORMAL,
      'low': JobPriority.LOW
    };

    const job = await addEmailJob(
      JobType.PROCESS_NEW_EMAIL,
      {
        userId,
        accountId,
        emailUid: Number(emailUid),
        folderName
      },
      priorityMap[priority] || JobPriority.NORMAL
    );

    res.json({
      success: true,
      jobId: job.id,
      message: 'Email processing job queued'
    });
  } catch (error) {
    console.error('Error queueing process email job:', error);
    res.status(500).json({
      error: 'Failed to queue job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Learn from user edit
router.post('/learn-from-edit', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { originalDraft, editedDraft, context } = req.body;

    if (!originalDraft || !editedDraft) {
      res.status(400).json({ error: 'originalDraft and editedDraft are required' });
      return;
    }

    const job = await addEmailJob(
      JobType.LEARN_FROM_EDIT,
      {
        userId,
        originalDraft,
        editedDraft,
        context
      },
      JobPriority.LOW  // Learning is lower priority
    );

    res.json({
      success: true,
      jobId: job.id,
      message: 'Learning job queued'
    });
  } catch (error) {
    console.error('Error queueing learn from edit job:', error);
    res.status(500).json({
      error: 'Failed to queue job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get job status by ID
router.get('/job/:jobId', requireAuth, async (req, res): Promise<void> => {
  try {
    const { jobId } = req.params;
    
    // Try to find in email queue first
    let job = await emailProcessingQueue.getJob(jobId);
    let queueName = 'email-processing';
    
    // If not found, try tone profile queue
    if (!job) {
      job = await toneProfileQueue.getJob(jobId);
      queueName = 'tone-profile';
    }
    
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const state = await job.getState();
    const progress = job.progress;

    res.json({
      id: job.id,
      name: job.name,
      queue: queueName,
      state,
      progress,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      timestamp: job.timestamp
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      error: 'Failed to get job status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clean failed jobs
router.post('/clean-failed', requireAuth, async (_req, res): Promise<void> => {
  try {
    await Promise.all([
      emailProcessingQueue.clean(0, 1000, 'failed'),
      toneProfileQueue.clean(0, 1000, 'failed')
    ]);

    res.json({
      success: true,
      message: 'Failed jobs cleaned'
    });
  } catch (error) {
    console.error('Error cleaning failed jobs:', error);
    res.status(500).json({
      error: 'Failed to clean jobs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;