#!/usr/bin/env ts-node

/**
 * Simple script to test BullMQ queue functionality
 */

import { 
  addEmailJob, 
  addToneProfileJob, 
  monitorQueueHealth,
  getQueueStats,
  emailProcessingQueue,
  toneProfileQueue,
  JobType,
  JobPriority
} from '../lib/queue';

async function testQueues() {
  console.log('🚀 Testing BullMQ Queue System...\n');

  try {
    // 1. Check Redis connection
    console.log('1. Checking queue health...');
    const health = await monitorQueueHealth();
    console.log('   Redis connected:', health.redis.connected);
    console.log('   Redis status:', health.redis.status);
    console.log('   Email queue healthy:', health.emailProcessing.healthy);
    console.log('   Tone queue healthy:', health.toneProfile.healthy);
    console.log('');

    // 2. Add test jobs
    console.log('2. Adding test jobs...');
    
    const emailJob = await addEmailJob(
      JobType.PROCESS_NEW_EMAIL,
      {
        userId: 'test-user-123',
        accountId: 'test-account-456',
        emailUid: 789,
        folderName: 'INBOX'
      },
      JobPriority.HIGH
    );
    console.log(`   ✅ Added email processing job: ${emailJob.id}`);

    const monitorJob = await addEmailJob(
      JobType.MONITOR_INBOX,
      {
        userId: 'test-user-123',
        accountId: 'test-account-456',
        folderName: 'INBOX'
      },
      JobPriority.NORMAL
    );
    console.log(`   ✅ Added inbox monitoring job: ${monitorJob.id}`);

    const toneJob = await addToneProfileJob(
      {
        userId: 'test-user-123',
        accountId: 'test-account-456',
        historyDays: 30
      },
      JobPriority.LOW
    );
    console.log(`   ✅ Added tone profile job: ${toneJob.id}`);
    console.log('');

    // 3. Check queue stats
    console.log('3. Queue statistics:');
    const emailStats = await getQueueStats(emailProcessingQueue);
    const toneStats = await getQueueStats(toneProfileQueue);
    
    console.log('   Email Processing Queue:');
    console.log(`     - Waiting: ${emailStats.waiting}`);
    console.log(`     - Active: ${emailStats.active}`);
    console.log(`     - Completed: ${emailStats.completed}`);
    console.log(`     - Failed: ${emailStats.failed}`);
    
    console.log('   Tone Profile Queue:');
    console.log(`     - Waiting: ${toneStats.waiting}`);
    console.log(`     - Active: ${toneStats.active}`);
    console.log(`     - Completed: ${toneStats.completed}`);
    console.log(`     - Failed: ${toneStats.failed}`);
    console.log('');

    // 4. Verify job retrieval
    console.log('4. Verifying job retrieval...');
    const retrievedJob = await emailProcessingQueue.getJob(emailJob.id!);
    if (retrievedJob) {
      const state = await retrievedJob.getState();
      console.log(`   ✅ Job ${emailJob.id} found in state: ${state}`);
      console.log(`   Priority: ${retrievedJob.opts.priority}`);
      console.log(`   Attempts configured: ${retrievedJob.opts.attempts}`);
    }
    console.log('');

    // 5. Clean up test jobs
    console.log('5. Cleaning up test jobs...');
    await emailJob.remove();
    await monitorJob.remove();
    await toneJob.remove();
    console.log('   ✅ Test jobs removed');
    console.log('');

    console.log('✅ All queue tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Queue test failed:', error);
    process.exit(1);
  } finally {
    // Close connections
    await emailProcessingQueue.close();
    await toneProfileQueue.close();
    process.exit(0);
  }
}

// Run the test
testQueues();