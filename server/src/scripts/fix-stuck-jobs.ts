#!/usr/bin/env ts-node

import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: 'localhost',
  port: 6380,
  maxRetriesPerRequest: null
});

const emailQueue = new Queue('email-processing', { connection });
const toneQueue = new Queue('tone-profile', { connection });

async function fixStuckJobs() {
  console.log('Fixing stuck jobs...\n');
  
  // Get all active jobs
  const emailActive = await emailQueue.getJobs(['active']);
  const toneActive = await toneQueue.getJobs(['active']);
  
  console.log(`Found ${emailActive.length} stuck email jobs`);
  console.log(`Found ${toneActive.length} stuck tone jobs\n`);
  
  // Move active jobs back to waiting by retrying them
  for (const job of emailActive) {
    console.log(`Retrying email job ${job.id} to move from active to waiting`);
    await job.retry('manual');
  }
  
  for (const job of toneActive) {
    console.log(`Retrying tone job ${job.id} to move from active to waiting`);
    await job.retry('manual');
  }
  
  // Get updated counts
  const emailCounts = await emailQueue.getJobCounts();
  const toneCounts = await toneQueue.getJobCounts();
  
  console.log('\nUpdated queue counts:');
  console.log('Email queue:', emailCounts);
  console.log('Tone queue:', toneCounts);
  
  await connection.quit();
  await emailQueue.close();
  await toneQueue.close();
}

fixStuckJobs().catch(console.error);