import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { 
  JobType, 
  BuildToneProfileJobData,
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

// Build tone profile job handler
async function buildToneProfile(job: Job<BuildToneProfileJobData>) {
  const { userId, accountId, historyDays = 30 } = job.data;
  const updateProgress = createProgressReporter(job);
  
  try {
    await updateProgress(5, 'Starting tone profile build');
    
    // Calculate date range
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - historyDays);
    
    await updateProgress(10, 'Connecting to IMAP');
    const imapSession = await ImapSession.fromAccountId(accountId, userId);
    
    try {
      // Analyze sent emails for tone patterns
      await updateProgress(20, 'Searching sent emails');
      
      // Try common sent folder names
      const sentFolders = ['[Gmail]/Sent Mail', 'Sent', 'Sent Items', 'INBOX.Sent'];
      let sentFolder: string | null = null;
      let sentMessages: any[] = [];
      
      // Find the sent folder
      const folders = await imapSession.getFolders();
      for (const folderName of sentFolders) {
        const folder = folders.find(f => 
          f.name === folderName || 
          f.path === folderName ||
          f.name.toLowerCase().includes('sent')
        );
        
        if (folder) {
          sentFolder = folder.path;
          break;
        }
      }
      
      if (!sentFolder) {
        throw new Error('Sent folder not found');
      }
      
      await updateProgress(30, `Analyzing emails from ${sentFolder}`);
      
      // Get sent messages
      sentMessages = await imapSession.searchMessages(
        sentFolder,
        { since: sinceDate },
        { limit: 100 }  // Analyze up to 100 recent emails
      );
      
      await updateProgress(40, `Found ${sentMessages.length} sent emails`);
      
      if (sentMessages.length === 0) {
        return {
          success: true,
          message: 'No sent emails found in the specified period',
          emailsAnalyzed: 0
        };
      }
      
      // Batch fetch message contents
      await updateProgress(50, 'Fetching email contents');
      const uids = sentMessages.map(msg => msg.uid);
      const fullMessages = await imapSession.getMessagesRaw(sentFolder, uids);
      
      await updateProgress(60, 'Analyzing writing patterns');
      
      // Extract patterns from emails
      const patterns = {
        greetings: new Map<string, number>(),
        closings: new Map<string, number>(),
        phrases: new Map<string, number>(),
        sentenceLengths: [] as number[],
        wordCounts: [] as number[],
        formality: {
          formal: 0,
          informal: 0,
          neutral: 0
        }
      };
      
      // Analyze each email
      for (const [index, message] of fullMessages.entries()) {
        const progress = 60 + Math.floor((index / fullMessages.length) * 30);
        await updateProgress(progress, `Analyzing email ${index + 1}/${fullMessages.length}`);
        
        // TODO: Implement actual NLP analysis here
        // This would involve:
        // 1. Parsing email body
        // 2. Extracting greeting/closing patterns
        // 3. Analyzing sentence structure
        // 4. Identifying common phrases
        // 5. Determining formality level
        
        // For now, just count basic stats
        const bodyLength = message.rawMessage?.length || 0;
        patterns.wordCounts.push(Math.floor(bodyLength / 5)); // Rough word count
      }
      
      await updateProgress(90, 'Saving tone profile');
      
      // Save or update tone profile
      const profileData = {
        patterns: {
          avgWordCount: patterns.wordCounts.reduce((a, b) => a + b, 0) / patterns.wordCounts.length,
          emailsAnalyzed: fullMessages.length,
          dateRange: {
            from: sinceDate,
            to: new Date()
          }
        },
        generatedAt: new Date()
      };
      
      // Check if profile exists
      const existingProfile = await pool.query(
        'SELECT id FROM tone_profiles WHERE user_id = $1',
        [userId]
      );
      
      if (existingProfile.rows.length > 0) {
        // Update existing profile
        await pool.query(
          `UPDATE tone_profiles 
           SET profile_data = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE user_id = $2`,
          [JSON.stringify(profileData), userId]
        );
      } else {
        // Create new profile
        await pool.query(
          `INSERT INTO tone_profiles (user_id, profile_data, created_at, updated_at) 
           VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [userId, JSON.stringify(profileData)]
        );
      }
      
      await updateProgress(100, 'Complete');
      
      return {
        success: true,
        emailsAnalyzed: fullMessages.length,
        profileData,
        message: 'Tone profile built successfully'
      };
      
    } finally {
      await imapSession.close();
    }
  } catch (error) {
    console.error('Error building tone profile:', error);
    throw error;
  }
}

// Create the worker
export const toneProfileWorker = new Worker(
  'tone-profile',
  async (job: Job) => {
    console.log(`Processing tone profile job ${job.id}`);
    
    if (job.name === JobType.BUILD_TONE_PROFILE) {
      return await buildToneProfile(job as Job<BuildToneProfileJobData>);
    }
    
    throw new Error(`Unknown job type: ${job.name}`);
  },
  {
    connection,
    concurrency: 2,  // Process up to 2 jobs concurrently (heavy jobs)
    limiter: {
      max: 5,
      duration: 60000  // Max 5 jobs per minute
    }
  }
);

// Set up error handling
toneProfileWorker.on('failed', (job, error) => {
  if (job) {
    createJobErrorHandler('tone-profile')(job, error);
  }
});

toneProfileWorker.on('completed', (job) => {
  console.log(`Tone profile job ${job.id} completed successfully`);
});

toneProfileWorker.on('active', (job) => {
  console.log(`Tone profile job ${job.id} started processing`);
});

toneProfileWorker.on('progress', (job, progress) => {
  console.log(`Tone profile job ${job.id} progress: ${progress}%`);
});

// Graceful shutdown
export async function shutdownToneProfileWorker() {
  console.log('Shutting down tone profile worker...');
  await toneProfileWorker.close();
  await connection.quit();
  console.log('Tone profile worker shut down');
}

export default toneProfileWorker;