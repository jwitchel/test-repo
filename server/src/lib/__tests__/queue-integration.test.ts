/**
 * Integration test for BullMQ queue system
 * This tests that jobs can be queued and would be processed by workers
 */

import { 
  emailProcessingQueue, 
  toneProfileQueue,
  addEmailJob,
  addToneProfileJob,
  JobType,
  JobPriority,
  monitorQueueHealth
} from '../queue';

describe('Queue Integration Tests', () => {
  afterAll(async () => {
    // Clean up all jobs
    try {
      await emailProcessingQueue.obliterate({ force: true });
      await toneProfileQueue.obliterate({ force: true });
    } catch (error) {
      // Ignore obliterate errors
    }
    
    // Close connections
    await emailProcessingQueue.close();
    await toneProfileQueue.close();
    
    // Give a moment for connections to close
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  it('should queue and retrieve jobs correctly', async () => {
    // Add a process email job
    const emailJob = await addEmailJob(
      JobType.PROCESS_NEW_EMAIL,
      {
        userId: 'integration-test-user',
        accountId: 'integration-test-account',
        emailUid: 999,
        folderName: 'INBOX'
      },
      JobPriority.HIGH
    );

    expect(emailJob).toBeDefined();
    expect(emailJob.id).toBeDefined();

    // Retrieve the job
    const retrievedJob = await emailProcessingQueue.getJob(emailJob.id!);
    expect(retrievedJob).toBeDefined();
    expect(retrievedJob?.data.userId).toBe('integration-test-user');
    expect(retrievedJob?.opts.priority).toBe(JobPriority.HIGH);

    // Check job state (prioritized is a valid waiting state for jobs with priority)
    const state = await retrievedJob?.getState();
    expect(['waiting', 'prioritized', 'active']).toContain(state);
  });

  it('should handle multiple job types', async () => {
    // Queue different job types
    const jobs = await Promise.all([
      addEmailJob(JobType.MONITOR_INBOX, {
        userId: 'test-user',
        accountId: 'test-account',
        folderName: 'INBOX'
      }),
      addEmailJob(JobType.LEARN_FROM_EDIT, {
        userId: 'test-user',
        originalDraft: 'original',
        editedDraft: 'edited'
      }),
      addToneProfileJob({
        userId: 'test-user',
        accountId: 'test-account',
        historyDays: 7
      })
    ]);

    expect(jobs).toHaveLength(3);
    jobs.forEach(job => {
      expect(job.id).toBeDefined();
    });
  });

  it('should respect job priorities', async () => {
    // Add jobs with different priorities
    const lowPriorityJob = await addEmailJob(
      JobType.PROCESS_NEW_EMAIL,
      {
        userId: 'test',
        accountId: 'test',
        emailUid: 1,
        folderName: 'INBOX'
      },
      JobPriority.LOW
    );

    const highPriorityJob = await addEmailJob(
      JobType.PROCESS_NEW_EMAIL,
      {
        userId: 'test',
        accountId: 'test',
        emailUid: 2,
        folderName: 'INBOX'
      },
      JobPriority.CRITICAL
    );

    // High priority job should have lower priority value (processes first)
    expect(highPriorityJob.opts.priority).toBeLessThan(lowPriorityJob.opts.priority!);
  });

  it('should monitor queue health correctly', async () => {
    const health = await monitorQueueHealth();

    expect(health).toBeDefined();
    expect(health.emailProcessing).toBeDefined();
    expect(health.toneProfile).toBeDefined();
    expect(health.redis).toBeDefined();
    
    // Redis should be connected
    expect(health.redis.connected).toBe(true);
    
    // Queues should be healthy (not too many failed or waiting)
    expect(typeof health.emailProcessing.healthy).toBe('boolean');
    expect(typeof health.toneProfile.healthy).toBe('boolean');
  });

  it('should handle job retry configuration', async () => {
    const job = await addEmailJob(
      JobType.PROCESS_NEW_EMAIL,
      {
        userId: 'test',
        accountId: 'test',
        emailUid: 123,
        folderName: 'INBOX'
      }
    );

    // Check retry configuration
    expect(job.opts.attempts).toBe(3);
    expect(job.opts.backoff).toEqual({
      type: 'exponential',
      delay: 2000
    });
  });

  it('should clean up completed jobs according to configuration', async () => {
    const job = await addEmailJob(
      JobType.PROCESS_NEW_EMAIL,
      {
        userId: 'cleanup-test',
        accountId: 'test',
        emailUid: 456,
        folderName: 'INBOX'
      }
    );

    // Check cleanup configuration
    expect(job.opts.removeOnComplete).toEqual({
      count: 100,
      age: 3600
    });
    expect(job.opts.removeOnFail).toEqual({
      count: 50,
      age: 7200
    });
  });
});