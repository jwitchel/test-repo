#!/usr/bin/env ts-node

/**
 * Simple script to test BullMQ queue functionality
 */

import { 
  addEmailJob, 
  addToneProfileJob, 
  emailProcessingQueue,
  toneProfileQueue,
  JobType,
  JobPriority
} from '../lib/queue';

async function testQueues() {
  console.log('🚀 Testing BullMQ Queue System...\n');

  try {
    // 1. Check queue stats
    console.log('1. Checking queue stats...');
    const emailCounts = await emailProcessingQueue.getJobCounts();
    const toneCounts = await toneProfileQueue.getJobCounts();
    console.log('   Email queue:', emailCounts);
    console.log('   Tone queue:', toneCounts);
    console.log('');

    // 2. Add a test job
    console.log('2. Adding test jobs...');
    const toneJob = await addToneProfileJob(
      { 
        userId: 'test-user',
        accountId: 'test-account',
        historyDays: 30
      },
      JobPriority.NORMAL
    );
    console.log('   Tone profile job added:', toneJob.id);

    const emailJob = await addEmailJob(
      JobType.MONITOR_INBOX,
      {
        userId: 'test-user',
        accountId: 'test-account',
        folderName: 'INBOX'
      },
      JobPriority.HIGH
    );
    console.log('   Email job added:', emailJob.id);
    console.log('');

    // 3. Check job states
    console.log('3. Checking job states...');
    const toneState = await toneJob.getState();
    const emailState = await emailJob.getState();
    console.log('   Tone job state:', toneState);
    console.log('   Email job state:', emailState);
    console.log('');

    // 4. Get updated stats
    console.log('4. Updated queue stats...');
    const newEmailCounts = await emailProcessingQueue.getJobCounts();
    const newToneCounts = await toneProfileQueue.getJobCounts();
    console.log('   Email queue:', newEmailCounts);
    console.log('   Tone queue:', newToneCounts);
    console.log('');

    console.log('✅ Queue test completed successfully!');
    
    // Clean up
    await emailProcessingQueue.close();
    await toneProfileQueue.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Queue test failed:', error);
    process.exit(1);
  }
}

// Run the test
testQueues();