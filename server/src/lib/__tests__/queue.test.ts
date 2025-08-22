import { 
  emailProcessingQueue, 
  toneProfileQueue,
  addEmailJob,
  addToneProfileJob,
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
        JobPriority.NORMAL
      );

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.name).toBe(JobType.PROCESS_NEW_EMAIL);
      expect(job.data.userId).toBe('test-user-1');
    });

    it('should add monitor inbox job', async () => {
      const job = await addEmailJob(
        JobType.MONITOR_INBOX,
        {
          userId: 'test-user-2',
          accountId: 'test-account-2',
          folderName: 'INBOX'
        },
        JobPriority.HIGH
      );

      expect(job).toBeDefined();
      expect(job.name).toBe(JobType.MONITOR_INBOX);
      expect(job.opts.priority).toBe(JobPriority.HIGH);
    });

    it('should add learn from edit job', async () => {
      const job = await addEmailJob(
        JobType.LEARN_FROM_EDIT,
        {
          userId: 'test-user-3',
          originalDraft: 'original text',
          editedDraft: 'edited text',
          context: {
            recipient: 'test@example.com',
            subject: 'Test Subject'
          }
        },
        JobPriority.LOW
      );

      expect(job).toBeDefined();
      expect(job.name).toBe(JobType.LEARN_FROM_EDIT);
      expect(job.opts.priority).toBe(JobPriority.LOW);
    });

    it('should add build tone profile job', async () => {
      const job = await addToneProfileJob(
        {
          userId: 'test-user-4',
          accountId: 'test-account-4',
          historyDays: 30
        },
        JobPriority.CRITICAL
      );

      expect(job).toBeDefined();
      expect(job.name).toBe(JobType.BUILD_TONE_PROFILE);
      expect(job.opts.priority).toBe(JobPriority.CRITICAL);
      expect(job.data.historyDays).toBe(30);
    });
  });

  describe('Job Priority', () => {
    it('should handle all priority levels', async () => {
      const priorities = [
        JobPriority.CRITICAL,
        JobPriority.HIGH,
        JobPriority.NORMAL,
        JobPriority.LOW
      ];

      for (const priority of priorities) {
        const job = await addEmailJob(
          JobType.MONITOR_INBOX,
          {
            userId: 'test',
            accountId: 'test',
            folderName: 'INBOX'
          },
          priority
        );

        expect(job.opts.priority).toBe(priority);
      }
    });
  });

  describe('Queue Statistics', () => {
    it('should get queue statistics using native BullMQ methods', async () => {
      // Add a test job
      await addEmailJob(
        JobType.MONITOR_INBOX,
        {
          userId: 'stats-test',
          accountId: 'stats-test',
          folderName: 'INBOX'
        },
        JobPriority.NORMAL
      );

      // Get job counts directly from queues
      const emailCounts = await emailProcessingQueue.getJobCounts();
      const toneCounts = await toneProfileQueue.getJobCounts();

      expect(emailCounts).toBeDefined();
      expect(typeof emailCounts.waiting).toBe('number');
      expect(typeof emailCounts.active).toBe('number');
      expect(typeof emailCounts.completed).toBe('number');
      expect(typeof emailCounts.failed).toBe('number');

      expect(toneCounts).toBeDefined();
    });

    it('should check if queues are paused', async () => {
      const emailPaused = await emailProcessingQueue.isPaused();
      const tonePaused = await toneProfileQueue.isPaused();

      expect(typeof emailPaused).toBe('boolean');
      expect(typeof tonePaused).toBe('boolean');
    });
  });

  describe('Job Configuration', () => {
    it('should configure email jobs with simplified settings', async () => {
      const job = await addEmailJob(
        JobType.PROCESS_NEW_EMAIL,
        {
          userId: 'config-test',
          accountId: 'config-test',
          emailUid: 456,
          folderName: 'INBOX'
        },
        JobPriority.NORMAL
      );

      expect(job.opts.attempts).toBe(1); // No retries in simplified system
      expect(job.opts.removeOnComplete).toBeDefined();
      expect(job.opts.removeOnFail).toBeDefined();
    });

    it('should configure tone profile jobs with simplified settings', async () => {
      const job = await addToneProfileJob(
        {
          userId: 'config-test',
          accountId: 'config-test',
          historyDays: 60
        },
        JobPriority.HIGH
      );

      expect(job.opts.attempts).toBe(1); // No retries in simplified system
    });
  });

  describe('Queue Operations', () => {
    it('should retrieve jobs from queue', async () => {
      const job = await addEmailJob(
        JobType.MONITOR_INBOX,
        {
          userId: 'retrieve-test',
          accountId: 'retrieve-test',
          folderName: 'INBOX'
        },
        JobPriority.NORMAL
      );

      const retrieved = await emailProcessingQueue.getJob(job.id!);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(job.id);
    });

    it('should clean queue', async () => {
      // Add a job
      await addEmailJob(
        JobType.MONITOR_INBOX,
        {
          userId: 'clean-test',
          accountId: 'clean-test',
          folderName: 'INBOX'
        },
        JobPriority.NORMAL
      );

      // Clean the queue
      await emailProcessingQueue.obliterate({ force: true });
      
      // Check it's empty
      const counts = await emailProcessingQueue.getJobCounts();
      expect(counts.waiting).toBe(0);
    });
  });
});