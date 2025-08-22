/**
 * Tone Profile Worker
 * Calls the /api/training/analyze-patterns endpoint for background pattern analysis
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { BuildToneProfileJobData } from '../queue';
import { makeServiceRequest } from '../../middleware/service-auth';

// Redis connection for worker
const connection = new Redis({
  host: 'localhost',
  port: 6380,
  maxRetriesPerRequest: null
});

// Handler that calls the analyze-patterns API endpoint
async function buildToneProfile(job: Job<BuildToneProfileJobData>) {
  const { userId, accountId } = job.data;
  
  console.log(`[ToneWorker] Processing job ${job.id}: Building tone profile for user ${userId}, account ${accountId}`);
  
  try {
    // Use the service auth helper to call the API endpoint
    const result = await makeServiceRequest(
      'http://localhost:3002/api/training/analyze-patterns',
      'POST',
      { force: true },  // Force re-analysis even if patterns exist
      userId
    ) as {
      success: boolean;
      emailsAnalyzed: number;
      emailAccounts: number;
      relationshipsAnalyzed: number;
      relationships: string[];
      patternsByRelationship: any;
      durationSeconds: number;
    };
    
    console.log(`[ToneWorker] Job ${job.id} completed successfully:`, {
      emailsAnalyzed: result.emailsAnalyzed,
      relationshipsAnalyzed: result.relationshipsAnalyzed,
      durationSeconds: result.durationSeconds
    });
    
    return {
      success: true,
      profilesCreated: result.relationshipsAnalyzed,
      emailsAnalyzed: result.emailsAnalyzed,
      relationships: result.relationships,
      durationSeconds: result.durationSeconds
    };
  } catch (error) {
    console.error(`[ToneWorker] Job ${job.id} failed:`, error);
    throw error;
  }
}

// Create the worker
const toneWorker = new Worker(
  'tone-profile',
  buildToneProfile,
  {
    connection,
    concurrency: 2
  }
);

// Simple event logging
toneWorker.on('completed', (job) => {
  console.log(`[ToneWorker] Job ${job.id} completed`);
});

toneWorker.on('failed', (job, err) => {
  console.error(`[ToneWorker] Job ${job?.id} failed:`, err);
});

export default toneWorker;