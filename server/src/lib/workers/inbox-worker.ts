/**
 * Inbox Worker
 * Processes inbox emails using InboxProcessor service
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { JobType, ProcessInboxJobData } from '../queue';
import { imapLogger } from '../imap-logger';
import { inboxProcessor } from '../email-processing/inbox-processor';
import { pool } from '../../server';

const connection = new Redis({
  host: 'localhost',
  port: 6380,
  maxRetriesPerRequest: null
});

async function processInboxJob(job: Job<ProcessInboxJobData>): Promise<any> {
  const { userId, accountId } = job.data;

  // Always fetch current dry-run state from WorkerManager
  // JobScheduler caches job data, so we can't rely on job.data.dryRun
  const { workerManager } = await import('../worker-manager');
  const dryRun = await workerManager.isDryRunEnabled();

  // Log start
  imapLogger.log(userId, {
    userId,
    emailAccountId: accountId,
    level: 'info',
    command: 'worker.process_inbox.start',
    data: {
      raw: dryRun
        ? `Starting inbox processing (DRY-RUN) for account ${accountId}`
        : `Starting inbox processing for account ${accountId}`,
      parsed: { accountId, dryRun }
    }
  });

  // Get user's default LLM provider
  const providerResult = await pool.query(
    'SELECT id FROM llm_providers WHERE user_id = $1 AND is_default = true AND is_active = true LIMIT 1',
    [userId]
  );

  if (providerResult.rows.length === 0) {
    throw new Error('No default LLM provider configured. Please set a default provider in settings.');
  }

  const providerId = providerResult.rows[0].id;
  const batchSize = parseInt(process.env.INBOX_BATCH_SIZE || '10', 10);

  // Process batch
  const result = await inboxProcessor.processBatch({
    accountId,
    userId,
    providerId,
    dryRun,
    batchSize,
    offset: 0,
    force: false
  });

  // Log completion
  imapLogger.log(userId, {
    userId,
    emailAccountId: accountId,
    level: 'info',
    command: 'worker.process_inbox.complete',
    data: {
      raw: dryRun
        ? `[DRY RUN] Processed ${result.processed} emails in ${result.elapsed}ms`
        : `Processed ${result.processed} emails in ${result.elapsed}ms`,
      parsed: {
        processed: result.processed,
        elapsed: result.elapsed,
        dryRun,
        results: result.results
      }
    }
  });

  // Return summary
  return {
    success: true,
    processed: result.processed,
    draftsGenerated: result.results.filter(r => !r.error && r.action && !r.action.startsWith('silent')).length,
    silentActions: result.results.filter(r => !r.error && r.action && r.action.startsWith('silent')).length,
    errors: result.results.filter(r => r.error).length,
    elapsed: result.elapsed
  };
}

const inboxWorker = new Worker(
  'inbox',
  async (job: Job) => {
    const { userId } = job.data;

    try {
      if (job.name !== JobType.PROCESS_INBOX) {
        throw new Error(`Unknown job type: ${job.name}`);
      }

      return await processInboxJob(job as Job<ProcessInboxJobData>);

    } catch (error) {
      // Log error once
      imapLogger.log(userId, {
        userId,
        emailAccountId: (job.data as ProcessInboxJobData).accountId || 'unknown',
        level: 'error',
        command: 'worker.error',
        data: {
          raw: `Job ${job.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          parsed: { jobId: job.id, jobName: job.name }
        }
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
    autorun: false
  }
);

inboxWorker.on('completed', (job) => {
  console.log(`[InboxWorker] Job ${job.id} completed`);
});

inboxWorker.on('failed', (job, err) => {
  console.error(`[InboxWorker] Job ${job?.id} failed:`, err);
});

export default inboxWorker;
