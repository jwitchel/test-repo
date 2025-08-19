import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { 
  JobType, 
  ProcessNewEmailJobData, 
  MonitorInboxJobData, 
  LearnFromEditJobData,
  createJobErrorHandler,
  createProgressReporter
} from '../queue';
import { ImapSession } from '../imap-session';
import { pool } from '../../server';

// Redis connection for worker
const connection = new Redis({
  host: 'localhost',
  port: 6380,
  maxRetriesPerRequest: null
});

// Process new email job handler
async function processNewEmail(job: Job<ProcessNewEmailJobData>) {
  const { userId, accountId, emailUid, folderName } = job.data;
  const updateProgress = createProgressReporter(job);
  
  try {
    await updateProgress(10, 'Connecting to IMAP');
    
    // Get email from IMAP
    const imapSession = await ImapSession.fromAccountId(accountId, userId);
    
    try {
      await updateProgress(30, 'Fetching email');
      await imapSession.getMessageRaw(folderName, emailUid);
      
      await updateProgress(50, 'Analyzing email');
      // TODO: Implement actual email analysis
      // This would involve:
      // 1. Parsing the email
      // 2. Extracting context (sender, subject, etc.)
      // 3. Generating a draft response
      
      await updateProgress(70, 'Generating draft');
      // TODO: Call LLM to generate draft
      
      await updateProgress(90, 'Saving draft');
      // TODO: Save draft to database
      
      await updateProgress(100, 'Complete');
      
      return {
        success: true,
        emailUid,
        message: 'Email processed successfully'
      };
    } finally {
      await imapSession.close();
    }
  } catch (error) {
    console.error('Error processing new email:', error);
    throw error;
  }
}

// Monitor inbox job handler
async function monitorInbox(job: Job<MonitorInboxJobData>) {
  const { userId, accountId, folderName } = job.data;
  const updateProgress = createProgressReporter(job);
  
  try {
    await updateProgress(10, 'Connecting to IMAP');
    
    const imapSession = await ImapSession.fromAccountId(accountId, userId);
    
    try {
      await updateProgress(30, 'Checking for new emails');
      
      // Get last checked timestamp
      const lastCheckResult = await pool.query(
        'SELECT last_sync FROM email_accounts WHERE id = $1',
        [accountId]
      );
      
      const lastSync = lastCheckResult.rows[0]?.last_sync || new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      await updateProgress(50, 'Searching for new messages');
      const newMessages = await imapSession.searchMessages(
        folderName,
        { since: lastSync },
        { limit: 100 }
      );
      
      await updateProgress(70, `Found ${newMessages.length} new messages`);
      
      // Update last sync time
      await pool.query(
        'UPDATE email_accounts SET last_sync = CURRENT_TIMESTAMP WHERE id = $1',
        [accountId]
      );
      
      await updateProgress(90, 'Queueing new emails for processing');
      
      // Queue each new email for processing
      if (newMessages.length > 0) {
        const { addEmailJob, JobPriority } = await import('../queue');
        
        for (const message of newMessages) {
          await addEmailJob(
            JobType.PROCESS_NEW_EMAIL,
            {
              userId,
              accountId,
              emailUid: message.uid,
              folderName
            },
            JobPriority.NORMAL
          );
        }
      }
      
      await updateProgress(100, 'Complete');
      
      return {
        success: true,
        newMessages: newMessages.length,
        lastSync: new Date()
      };
    } finally {
      await imapSession.close();
    }
  } catch (error) {
    console.error('Error monitoring inbox:', error);
    throw error;
  }
}

// Learn from edit job handler
async function learnFromEdit(job: Job<LearnFromEditJobData>) {
  const { originalDraft, editedDraft, context } = job.data;
  const updateProgress = createProgressReporter(job);
  
  try {
    await updateProgress(10, 'Analyzing differences');
    
    // TODO: Implement learning logic
    // This would involve:
    // 1. Comparing original and edited drafts
    // 2. Extracting patterns and preferences
    // 3. Updating user's tone profile
    
    await updateProgress(50, 'Extracting patterns');
    
    // Simple diff for now
    const changes = {
      lengthChange: editedDraft.length - originalDraft.length,
      context: context || {},
      timestamp: new Date()
    };
    
    await updateProgress(80, 'Updating tone profile');
    
    // TODO: Update tone profile in database
    
    await updateProgress(100, 'Complete');
    
    return {
      success: true,
      changes,
      message: 'Learning from edit complete'
    };
  } catch (error) {
    console.error('Error learning from edit:', error);
    throw error;
  }
}

// Create the worker
export const emailWorker = new Worker(
  'email-processing',
  async (job: Job) => {
    console.log(`Processing job ${job.id} of type ${job.name}`);
    
    switch (job.name) {
      case JobType.PROCESS_NEW_EMAIL:
        return await processNewEmail(job as Job<ProcessNewEmailJobData>);
      
      case JobType.MONITOR_INBOX:
        return await monitorInbox(job as Job<MonitorInboxJobData>);
      
      case JobType.LEARN_FROM_EDIT:
        return await learnFromEdit(job as Job<LearnFromEditJobData>);
      
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: 5,  // Process up to 5 jobs concurrently
    limiter: {
      max: 10,
      duration: 1000  // Max 10 jobs per second
    }
  }
);

// Set up error handling
emailWorker.on('failed', (job, error) => {
  if (job) {
    createJobErrorHandler('email-processing')(job, error);
  }
});

emailWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

emailWorker.on('active', (job) => {
  console.log(`Job ${job.id} started processing`);
});

emailWorker.on('stalled', (jobId) => {
  console.warn(`Job ${jobId} has stalled`);
});

// Graceful shutdown
export async function shutdownEmailWorker() {
  console.log('Shutting down email worker...');
  await emailWorker.close();
  await connection.quit();
  console.log('Email worker shut down');
}

export default emailWorker;