#!/usr/bin/env ts-node

/**
 * Demo script to show all job states
 * This creates various jobs to demonstrate the job monitoring system
 */

// Set environment to skip server start
process.env.SKIP_SERVER_START = 'true';

import { 
  addEmailJob, 
  addToneProfileJob,
  JobType,
  JobPriority
} from '../lib/queue';

async function createDemoJobs() {
  console.log('🎯 Creating demo jobs to show all states...\n');
  
  try {
    // 1. Create a successful job
    console.log('1. Creating a job that will complete successfully...');
    const successJob = await addToneProfileJob({
      userId: 'demo-user-001',
      accountId: 'success-account',
      historyDays: 7
    }, JobPriority.HIGH);
    console.log(`   ✅ Created job ${successJob.id} (will complete)\n`);
    
    // 2. Create a job that will take longer (show progress)
    console.log('2. Creating a job that shows progress...');
    const progressJob = await addEmailJob(
      JobType.MONITOR_INBOX,
      {
        userId: 'demo-user-002',
        accountId: 'progress-account',
        folderName: 'INBOX'
      },
      JobPriority.NORMAL
    );
    console.log(`   ⏳ Created job ${progressJob.id} (will show progress)\n`);
    
    // 3. Create a job that will fail
    console.log('3. Creating a job that will fail...');
    const failJob = await addEmailJob(
      JobType.PROCESS_NEW_EMAIL,
      {
        userId: 'demo-user-003',
        accountId: 'invalid-account-that-will-fail',
        emailUid: 999999,
        folderName: 'INBOX'
      },
      JobPriority.LOW
    );
    console.log(`   ❌ Created job ${failJob.id} (will fail)\n`);
    
    // 4. Create multiple queued jobs
    console.log('4. Creating multiple jobs to show queue...');
    for (let i = 0; i < 3; i++) {
      const queuedJob = await addEmailJob(
        JobType.LEARN_FROM_EDIT,
        {
          userId: `demo-user-00${i + 4}`,
          originalDraft: `Original text ${i}`,
          editedDraft: `Edited text ${i}`,
          context: { subject: `Test ${i}` }
        },
        JobPriority.LOW
      );
      console.log(`   📋 Created job ${queuedJob.id} (queued)`);
    }
    
    console.log('\n✨ Demo jobs created!\n');
    console.log('Now check the /dashboard/jobs page to see:');
    console.log('  - Jobs moving from "queued" to "active" to "completed"');
    console.log('  - Progress bars updating in real-time');
    console.log('  - Failed jobs with error messages');
    console.log('  - Statistics updating automatically');
    console.log('\nThe workers will process these jobs if they\'re running.');
    console.log('If workers aren\'t running, start them with: npm run workers');
    
  } catch (error) {
    console.error('Error creating demo jobs:', error);
  }
  
  process.exit(0);
}

createDemoJobs();