/**
 * Email Processing Worker
 * Main worker that handles all email-related job processing
 */

// Set environment to skip server start when importing pool
process.env.SKIP_SERVER_START = 'true';

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { 
  JobType, 
  ProcessNewEmailJobData, 
  MonitorInboxJobData, 
  LearnFromEditJobData,
  BuildToneProfileJobData
} from '../lib/queue';
import { ImapSession } from '../lib/imap-session';
import { pool } from '../server';

// Logging levels
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// Configure log level from environment or default to INFO
const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;

class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(LOG_LEVEL);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level}] [${this.context}] ${message}`;
    return data ? `${base} ${JSON.stringify(data)}` : base;
  }

  debug(message: string, data?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, message, data));
    }
  }

  info(message: string, data?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message, data));
    }
  }

  warn(message: string, data?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, data));
    }
  }

  error(message: string, data?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, data));
    }
  }
}

// Redis connection for workers
const connection = new Redis({
  host: 'localhost',
  port: 6380,
  maxRetriesPerRequest: null
});

// Progress reporter with logging
function createProgressReporter(job: Job, logger: Logger) {
  return async (progress: number, message?: string) => {
    await job.updateProgress(progress);
    logger.debug(`Progress: ${progress}%`, { jobId: job.id, message });
  };
}

/**
 * Process New Email Worker
 * Handles processing of individual new emails
 */
async function processNewEmail(job: Job<ProcessNewEmailJobData>, logger: Logger) {
  const { userId, accountId, emailUid, folderName } = job.data;
  const updateProgress = createProgressReporter(job, logger);
  
  logger.info('Starting new email processing', { userId, accountId, emailUid, folderName });
  
  try {
    await updateProgress(10, 'Connecting to IMAP');
    const imapSession = await ImapSession.fromAccountId(accountId, userId);
    
    try {
      await updateProgress(30, 'Fetching email');
      const email = await imapSession.getMessageRaw(folderName, emailUid);
      logger.debug('Email fetched', { 
        uid: email.uid, 
        from: email.from, 
        subject: email.subject,
        size: email.size 
      });
      
      await updateProgress(50, 'Analyzing email content');
      // TODO: Implement actual email analysis
      // Placeholder for now
      const analysisResult = {
        sentiment: 'neutral',
        urgency: 'normal',
        category: 'general'
      };
      logger.debug('Email analyzed', analysisResult);
      
      await updateProgress(70, 'Generating draft response');
      // TODO: Call LLM to generate draft
      const draftResponse = {
        draft: 'Thank you for your email. I will review and respond shortly.',
        confidence: 0.75
      };
      logger.debug('Draft generated', { confidence: draftResponse.confidence });
      
      await updateProgress(90, 'Saving results');
      // TODO: Save draft to database
      
      await updateProgress(100, 'Complete');
      logger.info('Email processing completed', { 
        emailUid, 
        processingTime: Date.now() - job.timestamp 
      });
      
      return {
        success: true,
        emailUid,
        analysisResult,
        draftGenerated: true
      };
    } finally {
      await imapSession.close();
    }
  } catch (error) {
    logger.error('Error processing new email', { 
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      jobData: job.data 
    });
    throw error;
  }
}

/**
 * Monitor Inbox Worker
 * Periodically checks for new emails in monitored folders
 */
async function monitorInbox(job: Job<MonitorInboxJobData>, logger: Logger) {
  const { userId, accountId, folderName } = job.data;
  const updateProgress = createProgressReporter(job, logger);
  
  logger.info('Starting inbox monitoring', { userId, accountId, folderName });
  
  try {
    await updateProgress(10, 'Connecting to IMAP');
    const imapSession = await ImapSession.fromAccountId(accountId, userId);
    
    try {
      await updateProgress(20, 'Retrieving last sync time');
      const lastCheckResult = await pool.query(
        'SELECT last_sync FROM email_accounts WHERE id = $1',
        [accountId]
      );
      
      const lastSync = lastCheckResult.rows[0]?.last_sync || new Date(Date.now() - 24 * 60 * 60 * 1000);
      logger.debug('Last sync time', { lastSync });
      
      await updateProgress(40, 'Searching for new messages');
      const newMessages = await imapSession.searchMessages(
        folderName,
        { since: lastSync },
        { limit: 100 }
      );
      
      logger.info('New messages found', { 
        count: newMessages.length,
        folder: folderName 
      });
      
      if (newMessages.length > 0) {
        await updateProgress(60, 'Queueing messages for processing');
        
        const { addEmailJob, JobPriority } = await import('../lib/queue');
        const queuedJobs = [];
        
        for (const message of newMessages) {
          const job = await addEmailJob(
            JobType.PROCESS_NEW_EMAIL,
            {
              userId,
              accountId,
              emailUid: message.uid,
              folderName
            },
            JobPriority.NORMAL
          );
          queuedJobs.push(job.id);
          logger.debug('Queued email for processing', { 
            uid: message.uid, 
            jobId: job.id 
          });
        }
        
        logger.info('Emails queued for processing', { 
          count: queuedJobs.length,
          jobIds: queuedJobs 
        });
      }
      
      await updateProgress(80, 'Updating last sync time');
      await pool.query(
        'UPDATE email_accounts SET last_sync = CURRENT_TIMESTAMP WHERE id = $1',
        [accountId]
      );
      
      await updateProgress(100, 'Complete');
      logger.info('Inbox monitoring completed', { 
        newMessages: newMessages.length,
        processingTime: Date.now() - job.timestamp 
      });
      
      return {
        success: true,
        newMessages: newMessages.length,
        lastSync: new Date()
      };
    } finally {
      await imapSession.close();
    }
  } catch (error) {
    logger.error('Error monitoring inbox', { 
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      jobData: job.data 
    });
    throw error;
  }
}

/**
 * Learn From Edit Worker (STUB)
 * Stub implementation that just logs a message
 */
async function learnFromEdit(job: Job<LearnFromEditJobData>, logger: Logger) {
  const { userId } = job.data;
  const updateProgress = createProgressReporter(job, logger);
  
  logger.info('Learn From Edit Worker Ran', { userId });
  
  try {
    await updateProgress(10, 'Starting learn from edit');
    
    // STUB: Just log and return
    logger.info('STUB: Learn from edit would analyze user edits', {
      userId,
      message: 'This is a stub implementation'
    });
    
    await updateProgress(100, 'Complete (stub)');
    
    return {
      success: true,
      stub: true,
      message: 'Learn From Edit Worker Ran'
    };
  } catch (error) {
    logger.error('Error in learn from edit stub', { 
      error: error instanceof Error ? error.message : error 
    });
    throw error;
  }
}

/**
 * Tone Profile Builder Worker (STUB)
 * Stub implementation that just logs a message
 */
async function buildToneProfile(job: Job<BuildToneProfileJobData>, logger: Logger) {
  const { userId, accountId, historyDays = 30 } = job.data;
  const updateProgress = createProgressReporter(job, logger);
  
  logger.info('Tone Profile Builder Worker Ran', { userId, accountId, historyDays });
  
  try {
    await updateProgress(10, 'Starting tone profile build');
    
    // STUB: Just log and return
    logger.info('STUB: Tone profile building would analyze email history', {
      userId,
      accountId,
      historyDays,
      message: 'This is a stub implementation'
    });
    
    await updateProgress(100, 'Complete (stub)');
    
    return {
      success: true,
      stub: true,
      message: 'Tone Profile Builder Worker Ran'
    };
  } catch (error) {
    logger.error('Error in tone profile builder stub', { 
      error: error instanceof Error ? error.message : error 
    });
    throw error;
  }
}

// Create Email Processing Worker
const emailLogger = new Logger('EmailWorker');

export const emailProcessingWorker = new Worker(
  'email-processing',
  async (job: Job) => {
    const startTime = Date.now();
    emailLogger.debug(`Processing job ${job.id} of type ${job.name}`, { 
      data: job.data,
      attempts: job.attemptsMade 
    });
    
    try {
      let result;
      switch (job.name) {
        case JobType.PROCESS_NEW_EMAIL:
          result = await processNewEmail(job as Job<ProcessNewEmailJobData>, emailLogger);
          break;
        
        case JobType.MONITOR_INBOX:
          result = await monitorInbox(job as Job<MonitorInboxJobData>, emailLogger);
          break;
        
        case JobType.LEARN_FROM_EDIT:
          result = await learnFromEdit(job as Job<LearnFromEditJobData>, emailLogger);
          break;
        
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
      
      const duration = Date.now() - startTime;
      emailLogger.info(`Job completed successfully`, { 
        jobId: job.id,
        jobType: job.name,
        duration,
        result 
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      emailLogger.error(`Job failed`, { 
        jobId: job.id,
        jobType: job.name,
        duration,
        attempt: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000
    }
  }
);

// Create Tone Profile Worker
const toneLogger = new Logger('ToneProfileWorker');

export const toneProfileWorker = new Worker(
  'tone-profile',
  async (job: Job) => {
    const startTime = Date.now();
    toneLogger.debug(`Processing tone profile job ${job.id}`, { 
      data: job.data,
      attempts: job.attemptsMade 
    });
    
    try {
      const result = await buildToneProfile(job as Job<BuildToneProfileJobData>, toneLogger);
      
      const duration = Date.now() - startTime;
      toneLogger.info(`Tone profile job completed`, { 
        jobId: job.id,
        duration,
        result 
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      toneLogger.error(`Tone profile job failed`, { 
        jobId: job.id,
        duration,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  },
  {
    connection,
    concurrency: 2,
    limiter: {
      max: 5,
      duration: 60000
    }
  }
);

// Error handling
emailProcessingWorker.on('failed', (job, error) => {
  if (job) {
    emailLogger.error(`Job permanently failed after ${job.attemptsMade} attempts`, {
      jobId: job.id,
      jobType: job.name,
      error: error.message,
      finalAttempt: job.attemptsMade === job.opts.attempts
    });
  }
});

emailProcessingWorker.on('stalled', (jobId) => {
  emailLogger.warn(`Job stalled`, { jobId });
});

toneProfileWorker.on('failed', (job, error) => {
  if (job) {
    toneLogger.error(`Tone profile job permanently failed`, {
      jobId: job.id,
      error: error.message
    });
  }
});

// Graceful shutdown
export async function shutdownWorkers() {
  emailLogger.info('Shutting down workers...');
  await emailProcessingWorker.close();
  await toneProfileWorker.close();
  await connection.quit();
  emailLogger.info('Workers shut down successfully');
}

// Handle process termination
process.on('SIGTERM', async () => {
  await shutdownWorkers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownWorkers();
  process.exit(0);
});

// Start workers
emailLogger.info('Email processing workers started', {
  concurrency: 5,
  logLevel: LOG_LEVEL
});

toneLogger.info('Tone profile worker started', {
  concurrency: 2,
  logLevel: LOG_LEVEL
});

export default {
  emailProcessingWorker,
  toneProfileWorker,
  shutdownWorkers
};