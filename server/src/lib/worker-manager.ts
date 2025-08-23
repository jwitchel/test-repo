/**
 * Worker Manager
 * Centralized management of BullMQ workers with pause/resume functionality
 */

import { Worker } from 'bullmq';
import Redis from 'ioredis';
import emailProcessingWorker from './workers/email-processing-worker';
import toneProfileWorker from './workers/tone-profile-worker';
import { emailProcessingQueue, toneProfileQueue } from './queue';

// Redis keys for storing worker state
const WORKER_STATE_KEY = 'worker:manager:paused';
const QUEUE_STATE_KEY = 'queue:manager:paused';

export class WorkerManager {
  private static instance: WorkerManager;
  private workers: Map<string, Worker> = new Map();
  private queues: Map<string, any> = new Map();
  private redis: Redis;
  private isPaused: boolean = false;

  private constructor() {
    this.redis = new Redis({
      host: 'localhost',
      port: 6380,
      maxRetriesPerRequest: null
    });

    // Register workers
    this.workers.set('email-processing', emailProcessingWorker);
    this.workers.set('tone-profile', toneProfileWorker);

    // Register queues
    this.queues.set('email-processing', emailProcessingQueue);
    this.queues.set('tone-profile', toneProfileQueue);
  }

  static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  /**
   * Initialize the worker manager and restore state
   */
  async initialize(): Promise<void> {
    try {
      // Check if we should start paused (from env or Redis)
      const defaultPaused = process.env.WORKERS_START_PAUSED === 'true';
      
      // Try to get stored state from Redis
      const storedState = await this.redis.get(WORKER_STATE_KEY);
      
      if (storedState !== null) {
        // Use stored state
        this.isPaused = storedState === 'true';
        console.log(`[WorkerManager] Restored state from Redis: ${this.isPaused ? 'PAUSED' : 'ACTIVE'}`);
      } else {
        // Use env variable or default to paused
        this.isPaused = defaultPaused !== false; // Default to true (paused) if not specified
        await this.redis.set(WORKER_STATE_KEY, String(this.isPaused));
        console.log(`[WorkerManager] Initial state: ${this.isPaused ? 'PAUSED' : 'ACTIVE'} (from env: WORKERS_START_PAUSED=${process.env.WORKERS_START_PAUSED})`);
      }

      // Apply initial state to all workers
      if (this.isPaused) {
        await this.pauseAllWorkers(true); // true = don't wait for active jobs on startup
      }
    } catch (error) {
      console.error('[WorkerManager] Error during initialization:', error);
      // Default to paused state on error
      this.isPaused = true;
      await this.pauseAllWorkers(true); // true = don't wait on startup
    }
  }

  /**
   * Pause all workers
   * @param doNotWaitActive - If true, pause immediately without waiting for active jobs to complete
   */
  async pauseAllWorkers(doNotWaitActive: boolean = false): Promise<void> {
    console.log(`[WorkerManager] Pausing all workers (wait for active: ${!doNotWaitActive})`);
    
    const pausePromises = Array.from(this.workers.values()).map(worker =>
      worker.pause(doNotWaitActive)
    );
    
    await Promise.all(pausePromises);
    this.isPaused = true;
    await this.redis.set(WORKER_STATE_KEY, 'true');
    
    console.log('[WorkerManager] All workers paused');
  }

  /**
   * Resume all workers
   */
  async resumeAllWorkers(): Promise<void> {
    console.log('[WorkerManager] Resuming all workers');
    
    const resumePromises = Array.from(this.workers.values()).map(worker =>
      worker.resume()
    );
    
    await Promise.all(resumePromises);
    this.isPaused = false;
    await this.redis.set(WORKER_STATE_KEY, 'false');
    
    console.log('[WorkerManager] All workers resumed');
  }

  /**
   * Toggle worker state
   */
  async toggleWorkers(): Promise<boolean> {
    if (this.isPaused) {
      await this.resumeAllWorkers();
    } else {
      await this.pauseAllWorkers(true); // Wait for active jobs to complete
    }
    return !this.isPaused;
  }

  /**
   * Emergency pause all queues (not just workers)
   * This immediately stops all processing
   */
  async emergencyPauseQueues(): Promise<void> {
    console.log('[WorkerManager] EMERGENCY: Pausing all queues');
    
    const pausePromises = Array.from(this.queues.values()).map(queue =>
      queue.pause()
    );
    
    await Promise.all(pausePromises);
    await this.redis.set(QUEUE_STATE_KEY, 'true');
    
    console.log('[WorkerManager] All queues paused (emergency)');
  }

  /**
   * Resume all queues after emergency pause
   */
  async resumeQueues(): Promise<void> {
    console.log('[WorkerManager] Resuming all queues');
    
    const resumePromises = Array.from(this.queues.values()).map(queue =>
      queue.resume()
    );
    
    await Promise.all(resumePromises);
    await this.redis.set(QUEUE_STATE_KEY, 'false');
    
    console.log('[WorkerManager] All queues resumed');
  }

  /**
   * Check if queues are emergency paused
   */
  async areQueuesPaused(): Promise<boolean> {
    const state = await this.redis.get(QUEUE_STATE_KEY);
    return state === 'true';
  }

  /**
   * Get current worker status
   */
  async getStatus(): Promise<{
    workersPaused: boolean;
    queuesPaused: boolean;
    workers: Array<{ name: string; isPaused: boolean; isRunning: boolean }>;
    queues: Array<{ name: string; isPaused: boolean }>;
  }> {
    const queuesPaused = await this.areQueuesPaused();
    
    const workerStatuses = await Promise.all(
      Array.from(this.workers.entries()).map(async ([name, worker]) => ({
        name,
        isPaused: worker.isPaused(),
        isRunning: worker.isRunning()
      }))
    );
    
    const queueStatuses = await Promise.all(
      Array.from(this.queues.entries()).map(async ([name, queue]) => ({
        name,
        isPaused: await queue.isPaused()
      }))
    );
    
    return {
      workersPaused: this.isPaused,
      queuesPaused,
      workers: workerStatuses,
      queues: queueStatuses
    };
  }

  /**
   * Close all connections (for graceful shutdown)
   */
  async shutdown(): Promise<void> {
    console.log('[WorkerManager] Shutting down...');
    
    // Pause all workers first
    await this.pauseAllWorkers(false);
    
    // Close all workers
    const closePromises = Array.from(this.workers.values()).map(worker =>
      worker.close()
    );
    
    // Close all queues
    const queueClosePromises = Array.from(this.queues.values()).map(queue =>
      queue.close()
    );
    
    await Promise.all([...closePromises, ...queueClosePromises]);
    
    // Close Redis connection
    await this.redis.quit();
    
    console.log('[WorkerManager] Shutdown complete');
  }
}

// Export singleton instance
export const workerManager = WorkerManager.getInstance();