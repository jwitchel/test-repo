#!/usr/bin/env ts-node

/**
 * Start Email Processing Workers
 * This script starts the background workers that process jobs
 */

// Load environment variables FIRST
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Set environment to skip server start
process.env.SKIP_SERVER_START = 'true';

import inboxWorker from '../lib/workers/inbox-worker';
import trainingWorker from '../lib/workers/training-worker';
import { inboxQueue, trainingQueue } from '../lib/queue';
import { workerManager } from '../lib/worker-manager';

async function startWorkers() {
  console.log('🚀 Starting Background Workers...\n');

  // Initialize worker manager (restores pause state from Redis)
  await workerManager.initialize();

  // Get status for display
  const status = await workerManager.getStatus();

  // Large colored status display
  if (status.workersPaused) {
    console.log('\n' + '='.repeat(60));
    console.log('\x1b[31m%s\x1b[0m', '🛑 WORKERS ARE PAUSED - No background jobs will process');
    console.log('\x1b[31m%s\x1b[0m', '   Enable workers via Dashboard → Jobs page');
    console.log('='.repeat(60) + '\n');
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('\x1b[32m%s\x1b[0m', '✅ WORKERS ARE RUNNING - Background jobs will process');
    status.workers.forEach(w => {
      const runStatus = w.isRunning ? '▶️  Running' : '⏸️  Not Running';
      console.log('\x1b[32m%s\x1b[0m', `   ${w.name}: ${runStatus}`);
    });
    console.log('='.repeat(60) + '\n');
  }
}

startWorkers().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down workers...');
  await inboxWorker.close();
  await trainingWorker.close();
  await inboxQueue.close();
  await trainingQueue.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down workers...');
  await inboxWorker.close();
  await trainingWorker.close();
  await inboxQueue.close();
  await trainingQueue.close();
  process.exit(0);
});