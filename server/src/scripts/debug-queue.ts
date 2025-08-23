import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: 'localhost',
  port: 6380,
  maxRetriesPerRequest: null
});

const emailQueue = new Queue('email-processing', { connection });
const toneQueue = new Queue('tone-profile', { connection });

async function test() {
  // Get job counts
  const emailCounts = await emailQueue.getJobCounts();
  const toneCounts = await toneQueue.getJobCounts();
  
  console.log('Email queue counts:', emailCounts);
  console.log('Tone queue counts:', toneCounts);
  
  // Get waiting jobs
  const emailWaiting = await emailQueue.getJobs(['waiting'], 0, 19);
  const toneWaiting = await toneQueue.getJobs(['waiting'], 0, 19);
  
  console.log('Email waiting jobs:', emailWaiting.length);
  console.log('Tone waiting jobs:', toneWaiting.length);
  
  // Get all jobs
  const emailAll = await emailQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'], 0, 19);
  const toneAll = await toneQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'], 0, 19);
  
  console.log('Email all jobs:', emailAll.length);
  console.log('Tone all jobs:', toneAll.length);
  
  if (emailAll.length > 0) {
    console.log('Sample jobs:');
    for (let i = 0; i < Math.min(3, emailAll.length); i++) {
      const job = emailAll[i];
      console.log(`  Job ${job.id}:`, {
        name: job.name,
        state: await job.getState(),
        timestamp: new Date(job.timestamp).toISOString()
      });
    }
  }
  
  await connection.quit();
  await emailQueue.close();
  await toneQueue.close();
}

test().catch(console.error);