/**
 * Queue Event Listener
 * Listens to BullMQ events and broadcasts them via WebSocket
 */

import { QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { getUnifiedWebSocketServer } from '../websocket/unified-websocket';
import { emailProcessingQueue, toneProfileQueue } from './queue';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';

// Create queue event listeners with proper Redis config
const emailQueueEvents = new QueueEvents('email-processing', {
  connection: new Redis(REDIS_URL, {
    maxRetriesPerRequest: null
  })
});

const toneQueueEvents = new QueueEvents('tone-profile', {
  connection: new Redis(REDIS_URL, {
    maxRetriesPerRequest: null
  })
});

// Helper to broadcast job events
async function broadcastJobEvent(eventType: string, jobId: string, queueName: string, additionalData: any = {}) {
  const wsServer = getUnifiedWebSocketServer();
  if (!wsServer) {
    console.log(`WebSocket server not available for ${eventType} event`);
    return;
  }

  // Get job data to find userId
  let job;
  if (queueName === 'email-processing') {
    job = await emailProcessingQueue.getJob(jobId);
  } else if (queueName === 'tone-profile') {
    job = await toneProfileQueue.getJob(jobId);
  }

  if (job && job.data.userId) {
    console.log(`Broadcasting ${eventType} for job ${jobId} to user ${job.data.userId}`);
    wsServer.broadcastJobEvent({
      type: eventType,
      jobId,
      userId: job.data.userId,
      jobType: job.name,
      ...additionalData
    });
  } else {
    // Log detailed info for debugging
    console.log(`Cannot broadcast ${eventType} for job ${jobId}: job=${!!job}, userId=${job?.data?.userId}`);
    
    // Retry once after a short delay in case of timing issues
    if (!job && eventType === 'JOB_QUEUED') {
      setTimeout(async () => {
        const retryJob = queueName === 'email-processing' 
          ? await emailProcessingQueue.getJob(jobId)
          : await toneProfileQueue.getJob(jobId);
        
        if (retryJob && retryJob.data.userId) {
          console.log(`Retry successful: Broadcasting ${eventType} for job ${jobId} to user ${retryJob.data.userId}`);
          wsServer.broadcastJobEvent({
            type: eventType,
            jobId,
            userId: retryJob.data.userId,
            jobType: retryJob.name,
            ...additionalData
          });
        } else {
          console.log(`Retry failed: Still cannot get job ${jobId} or userId`);
        }
      }, 100);
    }
  }
}

// Set up event listeners for email queue
emailQueueEvents.on('added', ({ jobId }) => {
  console.log(`Job ${jobId} added to email queue`);
  broadcastJobEvent('JOB_QUEUED', jobId, 'email-processing');
});

emailQueueEvents.on('active', ({ jobId }) => {
  console.log(`Job ${jobId} is now active`);
  broadcastJobEvent('JOB_ACTIVE', jobId, 'email-processing');
});

emailQueueEvents.on('progress', ({ jobId, data }) => {
  broadcastJobEvent('JOB_PROGRESS', jobId, 'email-processing', { progress: data });
});

emailQueueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} completed`);
  broadcastJobEvent('JOB_COMPLETED', jobId, 'email-processing', { result: returnvalue });
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed:`, failedReason);
  broadcastJobEvent('JOB_FAILED', jobId, 'email-processing', { error: failedReason });
});

// Set up event listeners for tone profile queue
toneQueueEvents.on('added', ({ jobId }) => {
  console.log(`Job ${jobId} added to tone queue`);
  broadcastJobEvent('JOB_QUEUED', jobId, 'tone-profile');
});

toneQueueEvents.on('active', ({ jobId }) => {
  console.log(`Job ${jobId} is now active`);
  broadcastJobEvent('JOB_ACTIVE', jobId, 'tone-profile');
});

toneQueueEvents.on('progress', ({ jobId, data }) => {
  broadcastJobEvent('JOB_PROGRESS', jobId, 'tone-profile', { progress: data });
});

toneQueueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} completed`);
  broadcastJobEvent('JOB_COMPLETED', jobId, 'tone-profile', { result: returnvalue });
});

toneQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed:`, failedReason);
  broadcastJobEvent('JOB_FAILED', jobId, 'tone-profile', { error: failedReason });
});

// Export for cleanup
export function cleanupQueueEvents() {
  emailQueueEvents.close();
  toneQueueEvents.close();
}