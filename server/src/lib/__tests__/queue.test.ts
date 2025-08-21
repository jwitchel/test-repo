import { 
  emailProcessingQueue, 
  toneProfileQueue,
  addEmailJob,
  addToneProfileJob,
  getQueueStats,
  monitorQueueHealth,
  JobType,
  JobPriority
} from '../queue';

describe('BullMQ Queue Configuration', () => {
  afterAll(async () => {
    // Clean up after tests
    try {
      await emailProcessingQueue.obliterate({ force: true });
      await toneProfileQueue.obliterate({ force: true });
    } catch (error) {
      // Ignore obliterate errors
    }
    
    await emailProcessingQueue.close();
    await toneProfileQueue.close();
    
    // Give a moment for connections to close
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Queue Creation', () => {
    it('should create email processing queue', () => {
      expect(emailProcessingQueue).toBeDefined();
      expect(emailProcessingQueue.name).toBe('email-processing');
    });

    it('should create tone profile queue', () => {
      expect(toneProfileQueue).toBeDefined();
      expect(toneProfileQueue.name).toBe('tone-profile');
    });
  });

  describe('Job Addition', () => {
    it('should add process new email job', async () => {
      const job = await addEmailJob(
        JobType.PROCESS_NEW_EMAIL,
        {
          userId: 'test-user-1',
          accountId: 'test-account-1',
          emailUid: 123,
          folderName: 'INBOX'
        },
        JobPriority.HIGH
      );

      expect(job).toBeDefined();
      expect(job.name).toBe(JobType.PROCESS_NEW_EMAIL);
      expect(job.data.userId).toBe('test-user-1');
      expect(job.opts.priority).toBe(JobPriority.HIGH);
    });

    it('should add monitor inbox job', async () => {
      const job = await addEmailJob(
        JobType.MONITOR_INBOX,
        {
          userId: 'test-user-1',
          accountId: 'test-account-1',
          folderName: 'INBOX'
        }
      );

      expect(job).toBeDefined();
      expect(job.name).toBe(JobType.MONITOR_INBOX);
    });

    it('should add learn from edit job', async () => {
      const job = await addEmailJob(
        JobType.LEARN_FROM_EDIT,
        {
          userId: 'test-user-1',
          originalDraft: 'Original text',
          editedDraft: 'Edited text',
          context: {
            recipient: 'test@example.com',
            subject: 'Test Subject'
          }
        }
      );

      expect(job).toBeDefined();
      expect(job.name).toBe(JobType.LEARN_FROM_EDIT);
      expect(job.data.originalDraft).toBe('Original text');
    });

    it('should add tone profile job', async () => {
      const job = await addToneProfileJob(
        {
          userId: 'test-user-1',
          accountId: 'test-account-1',
          historyDays: 30
        },
        JobPriority.LOW
      );

      expect(job).toBeDefined();
      expect(job.name).toBe(JobType.BUILD_TONE_PROFILE);
      expect(job.data.historyDays).toBe(30);
      expect(job.opts.priority).toBe(JobPriority.LOW);
    });
  });

  describe('Queue Statistics', () => {
    it('should get queue statistics', async () => {
      const stats = await getQueueStats(emailProcessingQueue);

      expect(stats).toBeDefined();
      expect(typeof stats.waiting).toBe('number');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
      expect(typeof stats.delayed).toBe('number');
      expect(typeof stats.paused).toBe('number');
      expect(typeof stats.total).toBe('number');
    });

    it('should monitor queue health', async () => {
      const health = await monitorQueueHealth();

      expect(health).toBeDefined();
      expect(health.emailProcessing).toBeDefined();
      expect(health.toneProfile).toBeDefined();
      expect(health.redis).toBeDefined();
      expect(typeof health.emailProcessing.healthy).toBe('boolean');
      expect(typeof health.toneProfile.healthy).toBe('boolean');
      expect(typeof health.redis.connected).toBe('boolean');
    });
  });

  describe('Job Retry Configuration', () => {
    it('should have correct default job options', async () => {
      const job = await emailProcessingQueue.add('test-job', { test: true });
      
      expect(job.opts.attempts).toBe(3);
      expect(job.opts.backoff).toEqual({
        type: 'exponential',
        delay: 2000
      });
      expect(job.opts.removeOnComplete).toEqual({
        count: 100,
        age: 3600
      });
      expect(job.opts.removeOnFail).toEqual({
        count: 50,
        age: 7200
      });

      // Clean up - try to remove, but ignore if locked
      try {
        await job.remove();
      } catch (error: any) {
        // Ignore "locked" errors as the job might be being processed
        if (!error.message?.includes('locked')) {
          throw error;
        }
      }
    });

    it('should have different configuration for tone profile queue', async () => {
      const job = await toneProfileQueue.add('test-job', { test: true });
      
      expect(job.opts.attempts).toBe(2);
      expect(job.opts.backoff).toEqual({
        type: 'exponential',
        delay: 5000
      });

      // Clean up - try to remove, but ignore if locked
      try {
        await job.remove();
      } catch (error: any) {
        // Ignore "locked" errors as the job might be being processed
        if (!error.message?.includes('locked')) {
          throw error;
        }
      }
    });
  });

  describe('Priority Levels', () => {
    it('should respect job priorities', async () => {
      // Add jobs with different priorities
      const criticalJob = await emailProcessingQueue.add(
        'critical',
        { priority: 'critical' },
        { priority: JobPriority.CRITICAL }
      );
      
      const normalJob = await emailProcessingQueue.add(
        'normal',
        { priority: 'normal' },
        { priority: JobPriority.NORMAL }
      );
      
      const lowJob = await emailProcessingQueue.add(
        'low',
        { priority: 'low' },
        { priority: JobPriority.LOW }
      );

      expect(criticalJob.opts.priority).toBe(1);
      expect(normalJob.opts.priority).toBe(5);
      expect(lowJob.opts.priority).toBe(10);

      // Clean up - try to remove, but ignore if locked
      const removeJob = async (job: any) => {
        try {
          await job.remove();
        } catch (error: any) {
          // Ignore "locked" errors as the job might be being processed
          if (!error.message?.includes('locked')) {
            throw error;
          }
        }
      };
      
      await removeJob(criticalJob);
      await removeJob(normalJob);
      await removeJob(lowJob);
    });
  });
});