/**
 * Training Worker
 * Handles tone profile building and learning from user edits
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { JobType, BuildToneProfileJobData, LearnFromEditJobData } from '../queue';
import { makeServiceRequest } from '../../middleware/service-auth';
import { imapLogger } from '../imap-logger';

// Redis connection for worker
const connection = new Redis({
  host: 'localhost',
  port: 6380,
  maxRetriesPerRequest: null
});

// Handler for building tone profiles
async function buildToneProfile(job: Job<BuildToneProfileJobData>) {
  const { userId, accountId, fanOut } = job.data;

  // Check if this is a fan-out job (parent job that spawns child jobs)
  if (fanOut || !accountId) {
    console.log(`[TrainingWorker] Processing fan-out job ${job.id}: Rebuilding tone profiles for all accounts`);

    try {
      // Import here to avoid circular dependencies
      const { pool } = await import('../../server');
      const { addTrainingJob } = await import('../queue');
      const { JobPriority } = await import('../queue');

      // Get all email accounts for this user
      const result = await pool.query(
        'SELECT id, email_address FROM email_accounts WHERE user_id = $1',
        [userId]
      );

      console.log(`[TrainingWorker] Fan-out job ${job.id}: Found ${result.rows.length} accounts to process`);

      // Create child jobs for each account
      const childJobs = [];
      for (const row of result.rows) {
        const childJob = await addTrainingJob(
          JobType.BUILD_TONE_PROFILE,
          {
            userId,
            accountId: row.id,
            historyDays: job.data.historyDays || 30
          },
          JobPriority.HIGH
        );
        childJobs.push(childJob.id);
        console.log(`[TrainingWorker] Created child job ${childJob.id} for ${row.email_address}`);
      }

      return {
        success: true,
        fanOut: true,
        accountsProcessed: result.rows.length,
        childJobs
      };
    } catch (error) {
      console.error(`[TrainingWorker] Fan-out job ${job.id} failed:`, error);
      throw error;
    }
  }

  // Regular single-account tone profile building
  console.log(`[TrainingWorker] Processing job ${job.id}: Building tone profile for user ${userId}, account ${accountId}`);

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

    console.log(`[TrainingWorker] Job ${job.id} completed successfully:`, {
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
    console.error(`[TrainingWorker] Job ${job.id} failed:`, error);
    throw error;
  }
}

// Handler for learning from edits
async function learnFromEdit(job: Job<LearnFromEditJobData>) {
  const { userId, originalDraft, editedDraft, context } = job.data;

  console.warn(`[TrainingWorker] STUB: ${JobType.LEARN_FROM_EDIT} not implemented yet`);
  console.warn(`[TrainingWorker] Would learn from edit for user ${userId}`);

  // Send to real-time logs
  imapLogger.log(userId, {
    userId,
    emailAccountId: 'learning-system',
    level: 'warn',
    command: 'worker.stub.learn_from_edit',
    data: {
      raw: `STUB: Learn from edit functionality not implemented. Would analyze edits to improve tone profiles.`,
      parsed: {
        hasOriginal: !!originalDraft,
        hasEdited: !!editedDraft,
        hasContext: !!context
      }
    }
  });

  // TODO: When implemented, this would:
  // 1. Call POST /api/training/learn-from-edit endpoint
  // 2. Analyze differences between original and edited drafts
  // 3. Update user's tone profile based on changes
  // 4. Store learning data for future improvements

  return {
    success: true,
    stub: true,
    message: 'STUB: Learning from edit not implemented'
  };
}

// Create the worker that handles both types of training jobs
const trainingWorker = new Worker(
  'training',
  async (job: Job) => {
    console.log(`[TrainingWorker] Processing job ${job.id}: ${job.name}`);

    switch (job.name) {
      case JobType.BUILD_TONE_PROFILE:
        return buildToneProfile(job as Job<BuildToneProfileJobData>);

      case JobType.LEARN_FROM_EDIT:
        return learnFromEdit(job as Job<LearnFromEditJobData>);

      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: 2,
    autorun: false  // Don't start automatically - let WorkerManager control this
  }
);

// Event logging
trainingWorker.on('completed', (job) => {
  console.log(`[TrainingWorker] Job ${job.id} completed`);
});

trainingWorker.on('failed', (job, err) => {
  console.error(`[TrainingWorker] Job ${job?.id} failed:`, err);
});

export default trainingWorker;