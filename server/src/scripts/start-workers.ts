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

import emailProcessingWorker from '../lib/workers/email-processing-worker';
import toneWorker from '../lib/workers/tone-profile-worker';
import { emailProcessingQueue, toneProfileQueue } from '../lib/queue';
import { workerManager } from '../lib/worker-manager';

async function startWorkers() {
  console.log('🚀 Starting Email Processing Workers...\n');
  
  // Initialize worker manager (restores pause state from Redis)
  await workerManager.initialize();
  
  const status = await workerManager.getStatus();
  console.log(`Workers initial state: ${status.workersPaused ? 'PAUSED' : 'ACTIVE'}`);
  console.log('Workers are now running and will process jobs from the queue.');
  console.log('Press Ctrl+C to stop the workers.\n');
}

startWorkers().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down workers...');
  await emailProcessingWorker.close();
  await toneWorker.close();
  await emailProcessingQueue.close();
  await toneProfileQueue.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down workers...');
  await emailProcessingWorker.close();
  await toneWorker.close();
  await emailProcessingQueue.close();
  await toneProfileQueue.close();
  process.exit(0);
});