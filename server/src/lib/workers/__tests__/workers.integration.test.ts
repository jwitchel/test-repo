/**
 * Tests for background workers
 */

import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { JobType } from '../../queue';

describe('Worker Tests', () => {
  let connection: Redis;
  let emailQueue: Queue;
  let toneQueue: Queue;

  beforeAll(() => {
    connection = new Redis({
      host: 'localhost',
      port: 6380,
      maxRetriesPerRequest: null
    });

    emailQueue = new Queue('email-processing', { connection });
    toneQueue = new Queue('tone-profile', { connection });
  });

  afterAll(async () => {
    // Clean up
    await emailQueue.close();
    await toneQueue.close();
    await connection.quit();
  });

  describe('Email Processing Worker (Stub)', () => {
    it('should queue PROCESS_INBOX job', async () => {
      const job = await emailQueue.add(JobType.PROCESS_INBOX, {
        userId: 'test-user-stub',
        accountId: 'test-account-stub',
        folderName: 'INBOX'
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.name).toBe(JobType.PROCESS_INBOX);
      expect(job.data.userId).toBe('test-user-stub');
      expect(job.data.accountId).toBe('test-account-stub');
    });

    it('should queue LEARN_FROM_EDIT job', async () => {
      const job = await emailQueue.add(JobType.LEARN_FROM_EDIT, {
        userId: 'test-user-stub',
        originalDraft: 'Original email content',
        editedDraft: 'Edited email content',
        context: {
          recipient: 'test@example.com',
          subject: 'Test Subject'
        }
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.name).toBe(JobType.LEARN_FROM_EDIT);
      expect(job.data.userId).toBe('test-user-stub');
      expect(job.data.originalDraft).toBe('Original email content');
      expect(job.data.editedDraft).toBe('Edited email content');
    });
  });

  describe('Tone Profile Worker', () => {
    it('should queue build-tone-profile job', async () => {
      const job = await toneQueue.add('build-tone-profile', {
        userId: 'test-user-id',
        accountId: 'test-account-id'
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.name).toBe('build-tone-profile');
      expect(job.data.userId).toBe('test-user-id');
      expect(job.data.accountId).toBe('test-account-id');
    });

    it('should have correct job data structure', async () => {
      const jobData = {
        userId: 'user-123',
        accountId: 'account-456',
        historyDays: 30
      };

      const job = await toneQueue.add('build-tone-profile', jobData);
      
      expect(job.data).toEqual(jobData);
      expect(job.opts).toBeDefined();
    });
  });

  describe('Job Status Monitoring', () => {
    it('should track job state transitions', async () => {
      const job = await emailQueue.add(JobType.PROCESS_INBOX, {
        userId: 'test-monitor',
        accountId: 'test-account',
        folderName: 'INBOX'
      });

      const initialState = await job.getState();
      expect(['waiting', 'delayed']).toContain(initialState);

      // Job ID should be retrievable
      const retrievedJob = await Job.fromId(emailQueue, job.id!);
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(job.id);
    });
  });
});