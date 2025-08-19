import { Queue, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// Redis connection configuration
// Using port 6380 as configured in docker-compose.yml
const connection = new Redis({
  host: 'localhost',
  port: 6380,
  maxRetriesPerRequest: null
});

// Queue configuration with retry and failure handling
const defaultJobOptions = {
  removeOnComplete: {
    count: 100,  // Keep last 100 completed jobs
    age: 3600    // Remove completed jobs older than 1 hour
  },
  removeOnFail: {
    count: 50,   // Keep last 50 failed jobs
    age: 7200    // Remove failed jobs older than 2 hours
  },
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000  // Start with 2 second delay
  }
};

// Job types enum for type safety
export enum JobType {
  BUILD_TONE_PROFILE = 'build-tone-profile',
  MONITOR_INBOX = 'monitor-inbox',
  PROCESS_NEW_EMAIL = 'process-new-email',
  LEARN_FROM_EDIT = 'learn-from-edit'
}

// Job priority levels
export enum JobPriority {
  LOW = 10,
  NORMAL = 5,
  HIGH = 3,
  CRITICAL = 1
}

// Type definitions for job data
export interface BuildToneProfileJobData {
  userId: string;
  accountId: string;
  historyDays?: number;
}

export interface MonitorInboxJobData {
  userId: string;
  accountId: string;
  folderName: string;
}

export interface ProcessNewEmailJobData {
  userId: string;
  accountId: string;
  emailUid: number;
  folderName: string;
}

export interface LearnFromEditJobData {
  userId: string;
  originalDraft: string;
  editedDraft: string;
  context?: {
    recipient?: string;
    subject?: string;
  };
}

// Create queues for different job types
export const emailProcessingQueue = new Queue('email-processing', {
  connection,
  defaultJobOptions
});

// Queue for tone profile building (long-running jobs)
export const toneProfileQueue = new Queue('tone-profile', {
  connection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,  // Fewer retries for long-running jobs
    backoff: {
      type: 'exponential',
      delay: 5000  // Longer delay for heavy jobs
    }
  }
});

// Queue events for monitoring
export const emailQueueEvents = new QueueEvents('email-processing', {
  connection: connection.duplicate()
});

export const toneQueueEvents = new QueueEvents('tone-profile', {
  connection: connection.duplicate()
});

// Helper function to add jobs with proper typing
export async function addEmailJob(
  type: JobType,
  data: ProcessNewEmailJobData | MonitorInboxJobData | LearnFromEditJobData,
  priority: JobPriority = JobPriority.NORMAL
) {
  return emailProcessingQueue.add(type, data, {
    priority,
    delay: 0
  });
}

export async function addToneProfileJob(
  data: BuildToneProfileJobData,
  priority: JobPriority = JobPriority.LOW
) {
  return toneProfileQueue.add(JobType.BUILD_TONE_PROFILE, data, {
    priority,
    delay: 0
  });
}

// Graceful shutdown function
export async function shutdownQueues() {
  console.log('Shutting down queues...');
  
  await emailProcessingQueue.close();
  await toneProfileQueue.close();
  await emailQueueEvents.close();
  await toneQueueEvents.close();
  await connection.quit();
  
  console.log('Queues shut down successfully');
}

// Queue monitoring utilities
export async function getQueueStats(queue: Queue) {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused: 0,  // getPausedCount not available in current BullMQ version
    total: waiting + active + delayed
  };
}

// Error handling utilities
export function createJobErrorHandler(jobType: string) {
  return async (job: Job, error: Error) => {
    console.error(`Job ${jobType} failed:`, {
      jobId: job.id,
      jobName: job.name,
      attempt: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      error: error.message,
      stack: error.stack,
      data: job.data
    });

    // Log to database or monitoring service
    // This could be extended to send alerts for critical jobs
    if (job.attemptsMade === job.opts.attempts) {
      console.error(`Job ${jobType} permanently failed after ${job.opts.attempts} attempts`);
      // Could trigger alerts here
    }
  };
}

// Job progress reporter
export function createProgressReporter(job: Job) {
  return async (progress: number, message?: string) => {
    await job.updateProgress(progress);
    console.log(`Job ${job.name} progress: ${progress}%${message ? ` - ${message}` : ''}`);
  };
}

// Monitor queue health
export async function monitorQueueHealth() {
  const emailStats = await getQueueStats(emailProcessingQueue);
  const toneStats = await getQueueStats(toneProfileQueue);

  const health = {
    emailProcessing: {
      ...emailStats,
      healthy: emailStats.failed < 10 && emailStats.waiting < 100
    },
    toneProfile: {
      ...toneStats,
      healthy: toneStats.failed < 5 && toneStats.waiting < 20
    },
    redis: {
      connected: connection.status === 'ready',
      status: connection.status
    }
  };

  return health;
}

// Setup monitoring listeners
emailQueueEvents.on('completed', ({ jobId }) => {
  console.log(`Email job ${jobId} completed successfully`);
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Email job ${jobId} failed: ${failedReason}`);
});

toneQueueEvents.on('completed', ({ jobId }) => {
  console.log(`Tone profile job ${jobId} completed successfully`);
});

toneQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Tone profile job ${jobId} failed: ${failedReason}`);
});

// Handle process termination gracefully
process.on('SIGTERM', async () => {
  await shutdownQueues();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownQueues();
  process.exit(0);
});

export default {
  emailProcessingQueue,
  toneProfileQueue,
  emailQueueEvents,
  toneQueueEvents,
  addEmailJob,
  addToneProfileJob,
  getQueueStats,
  monitorQueueHealth,
  shutdownQueues,
  JobType,
  JobPriority
};