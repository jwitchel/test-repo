import express from 'express';
import { requireAuth } from '../middleware/auth';
import { 
  emailProcessingQueue,
  toneProfileQueue,
  JobType,
  JobPriority,
  addEmailJob,
  addToneProfileJob
} from '../lib/queue';

const router = express.Router();

// Queue a new job
router.post('/queue', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { type, data, priority = 'normal' } = req.body;

    if (!type || !data) {
      res.status(400).json({ error: 'Type and data are required' });
      return;
    }

    // Map priority string to enum
    const priorityMap: Record<string, JobPriority> = {
      'critical': JobPriority.CRITICAL,
      'high': JobPriority.HIGH,
      'normal': JobPriority.NORMAL,
      'low': JobPriority.LOW
    };
    
    const jobPriority = priorityMap[priority.toLowerCase()] || JobPriority.NORMAL;

    let job;
    
    // Queue the job based on type
    switch (type) {
      case JobType.BUILD_TONE_PROFILE:
        job = await addToneProfileJob(
          { ...data, userId },
          jobPriority
        );
        break;
        
      case JobType.PROCESS_INBOX:
      case JobType.LEARN_FROM_EDIT:
        job = await addEmailJob(
          type as JobType,
          { ...data, userId },
          jobPriority
        );
        break;
        
      default:
        res.status(400).json({ error: 'Invalid job type' });
        return;
    }

    res.json({
      jobId: job.id,
      type,
      status: await job.getState(),
      priority,
      createdAt: new Date(job.timestamp).toISOString()
    });
  } catch (error) {
    console.error('Error queuing job:', error);
    res.status(500).json({
      error: 'Failed to queue job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get job status directly from BullMQ
router.get('/status/:jobId', requireAuth, async (req, res): Promise<void> => {
  try {
    const { jobId } = req.params;

    // Try both queues
    let job = await emailProcessingQueue.getJob(jobId);
    if (!job) {
      job = await toneProfileQueue.getJob(jobId);
    }

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const state = await job.getState();
    
    res.json({
      jobId: job.id,
      type: job.name,
      status: state,
      progress: job.progress,
      data: job.data,
      result: job.returnvalue,
      error: job.failedReason,
      createdAt: new Date(job.timestamp).toISOString(),
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      error: 'Failed to get job status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List jobs directly from BullMQ
router.get('/list', requireAuth, async (req, res): Promise<void> => {
  try {
    const { status = 'all', limit = 20, offset = 0 } = req.query;

    // Get jobs from both queues
    const emailJobs = await emailProcessingQueue.getJobs(
      status === 'all' ? ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'] : [status as any],
      Number(offset),
      Number(offset) + Number(limit) - 1
    );

    const toneJobs = await toneProfileQueue.getJobs(
      status === 'all' ? ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'] : [status as any],
      Number(offset),
      Number(offset) + Number(limit) - 1
    );

    // Combine and sort by timestamp
    const allJobs = [...emailJobs, ...toneJobs]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, Number(limit));

    // Format jobs for response
    const formattedJobs = await Promise.all(allJobs.map(async (job) => ({
      jobId: job.id,
      type: job.name,
      status: await job.getState(),
      progress: job.progress,
      result: job.returnvalue,
      error: job.failedReason,
      createdAt: new Date(job.timestamp).toISOString(),
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : null
    })));

    res.json({
      jobs: formattedJobs,
      total: formattedJobs.length,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error('Error listing jobs:', error);
    res.status(500).json({
      error: 'Failed to list jobs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cancel a job
router.delete('/:jobId', requireAuth, async (req, res): Promise<void> => {
  try {
    const { jobId } = req.params;

    // Try both queues
    let job = await emailProcessingQueue.getJob(jobId);
    let removed = false;
    
    if (job) {
      await job.remove();
      removed = true;
    } else {
      job = await toneProfileQueue.getJob(jobId);
      if (job) {
        await job.remove();
        removed = true;
      }
    }

    if (!removed) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({
      jobId,
      status: 'cancelled',
      removed: true
    });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({
      error: 'Failed to cancel job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get job statistics directly from BullMQ
router.get('/stats', requireAuth, async (_req, res): Promise<void> => {
  try {
    // Get counts from both queues
    const emailCounts = await emailProcessingQueue.getJobCounts();
    const toneCounts = await toneProfileQueue.getJobCounts();

    // Get queue pause status
    const emailPaused = await emailProcessingQueue.isPaused();
    const tonePaused = await toneProfileQueue.isPaused();

    // Combined stats for backward compatibility
    // Include both 'waiting' and 'prioritized' jobs in the queued count
    const stats = {
      active: emailCounts.active + toneCounts.active,
      queued: (emailCounts.waiting || 0) + (toneCounts.waiting || 0) + 
              (emailCounts.prioritized || 0) + (toneCounts.prioritized || 0),
      completed: emailCounts.completed + toneCounts.completed,
      failed: emailCounts.failed + toneCounts.failed,
      delayed: emailCounts.delayed + toneCounts.delayed,
      paused: emailCounts.paused + toneCounts.paused,
      // Per-queue stats
      queues: {
        emailProcessing: {
          ...emailCounts,
          isPaused: emailPaused,
          name: 'Email Processing'
        },
        toneProfile: {
          ...toneCounts,
          isPaused: tonePaused,
          name: 'Tone Profile'
        }
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting job stats:', error);
    res.status(500).json({
      error: 'Failed to get stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clear all jobs from all queues - complete unconditional cleanup
router.post('/clear-all-queues', requireAuth, async (_req, res): Promise<void> => {
  try {
    console.log('Starting complete queue cleanup...');
    
    // Get counts before clearing
    const emailCounts = await emailProcessingQueue.getJobCounts();
    const toneCounts = await toneProfileQueue.getJobCounts();
    
    const totalBefore = 
      emailCounts.waiting + emailCounts.active + emailCounts.completed + emailCounts.failed + 
      emailCounts.delayed + emailCounts.paused + emailCounts.prioritized +
      toneCounts.waiting + toneCounts.active + toneCounts.completed + toneCounts.failed + 
      toneCounts.delayed + toneCounts.paused + toneCounts.prioritized;
    
    // First, try to move any stuck active jobs back to waiting
    try {
      const emailActive = await emailProcessingQueue.getJobs(['active']);
      const toneActive = await toneProfileQueue.getJobs(['active']);
      
      for (const job of emailActive) {
        try {
          await job.remove();
          console.log(`Removed stuck active email job ${job.id}`);
        } catch (e) {
          console.log(`Could not remove email job ${job.id}:`, e);
        }
      }
      
      for (const job of toneActive) {
        try {
          await job.remove();
          console.log(`Removed stuck active tone job ${job.id}`);
        } catch (e) {
          console.log(`Could not remove tone job ${job.id}:`, e);
        }
      }
    } catch (error) {
      console.log('Error removing active jobs (will continue with obliterate):', error);
    }
    
    // Clean both queues using BullMQ's obliterate (removes ALL jobs and data unconditionally)
    await emailProcessingQueue.obliterate({ force: true });
    await toneProfileQueue.obliterate({ force: true });
    
    // Verify cleanup
    const emailCountsAfter = await emailProcessingQueue.getJobCounts();
    const toneCountsAfter = await toneProfileQueue.getJobCounts();
    
    const totalAfter = 
      emailCountsAfter.waiting + emailCountsAfter.active + emailCountsAfter.completed + 
      emailCountsAfter.failed + emailCountsAfter.delayed + emailCountsAfter.paused + emailCountsAfter.prioritized +
      toneCountsAfter.waiting + toneCountsAfter.active + toneCountsAfter.completed + 
      toneCountsAfter.failed + toneCountsAfter.delayed + toneCountsAfter.paused + toneCountsAfter.prioritized;
    
    console.log(`Queue cleanup complete. Removed ${totalBefore} jobs. Remaining: ${totalAfter}`);
    
    res.json({
      success: true,
      message: 'All jobs cleared from all queues (complete unconditional cleanup)',
      cleared: totalBefore,
      remaining: totalAfter,
      queuesCleared: ['email-processing', 'tone-profile']
    });
  } catch (error) {
    console.error('Error clearing all queues:', error);
    res.status(500).json({
      error: 'Failed to clear all queues',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Keep old endpoint for backward compatibility (calls the new one)
router.post('/clear-queue', requireAuth, async (_req, res): Promise<void> => {
  try {
    console.log('Legacy /clear-queue endpoint called, redirecting to /clear-all-queues');
    
    // Get counts before clearing
    const emailCounts = await emailProcessingQueue.getJobCounts();
    const toneCounts = await toneProfileQueue.getJobCounts();
    
    const totalBefore = 
      emailCounts.waiting + emailCounts.active + emailCounts.completed + emailCounts.failed + 
      emailCounts.delayed + emailCounts.paused + emailCounts.prioritized +
      toneCounts.waiting + toneCounts.active + toneCounts.completed + toneCounts.failed + 
      toneCounts.delayed + toneCounts.paused + toneCounts.prioritized;
    
    // Clean both queues using BullMQ's obliterate
    await emailProcessingQueue.obliterate({ force: true });
    await toneProfileQueue.obliterate({ force: true });
    
    res.json({
      success: true,
      message: 'All jobs cleared from all queues',
      cleared: totalBefore,
      queuesCleared: ['email-processing', 'tone-profile']
    });
  } catch (error) {
    console.error('Error clearing all queues:', error);
    res.status(500).json({
      error: 'Failed to clear all queues',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;