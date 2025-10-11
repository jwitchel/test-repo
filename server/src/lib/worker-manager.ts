/**
 * Worker Manager
 * Centralized management of BullMQ workers with pause/resume functionality
 */

import { Worker } from 'bullmq';
import Redis from 'ioredis';
import inboxWorker from './workers/inbox-worker';
import trainingWorker from './workers/training-worker';
import { inboxQueue, trainingQueue } from './queue';

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
    this.redis = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null
    });

    // Register workers - log for debugging
    console.log('[WorkerManager] Registering workers:', {
      inboxWorker: inboxWorker ? 'defined' : 'undefined',
      trainingWorker: trainingWorker ? 'defined' : 'undefined'
    });

    this.workers.set('inbox', inboxWorker);
    this.workers.set('training', trainingWorker);

    // Register queues
    this.queues.set('inbox', inboxQueue);
    this.queues.set('training', trainingQueue);
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
      // Initialize worker pause state
      // Priority: Redis state > ENV (guaranteed to exist)
      const storedState = await this.redis.get(WORKER_STATE_KEY);

      if (storedState !== null) {
        // Use stored state from Redis
        this.isPaused = storedState === 'true';
      } else {
        // Use env variable - WORKERS_START_PAUSED (true = paused, false = running)
        this.isPaused = process.env.WORKERS_START_PAUSED === 'true';
        await this.redis.set(WORKER_STATE_KEY, String(this.isPaused));
      }

      console.log(`[WorkerManager] Initialized with state: isPaused=${this.isPaused}`);

      // Apply initial state to all workers
      if (this.isPaused) {
        await this.pauseAllWorkers(true); // true = don't wait for active jobs on startup
      } else {
        // If not paused, start all workers (since they have autorun: false)
        await this.resumeAllWorkers();
      }
    } catch (error) {
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

    const pausePromises = Array.from(this.workers.values())
      .filter(worker => worker !== undefined)
      .map(worker => worker.pause(doNotWaitActive));

    if (pausePromises.length === 0) {
      console.warn('[WorkerManager] No workers to pause - workers may not be initialized yet');
    }

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

    const resumePromises = Array.from(this.workers.values())
      .filter(worker => worker !== undefined)
      .map(async worker => {
        // First resume the worker (if it was paused)
        await worker.resume();
        // Then ensure it's running (in case autorun was false)
        if (!worker.isRunning()) {
          await worker.run();
        }
      });

    if (resumePromises.length === 0) {
      console.warn('[WorkerManager] No workers to resume - workers may not be initialized yet');
    }

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
    // Read actual worker paused state from Redis
    const storedState = await this.redis.get(WORKER_STATE_KEY);
    const actualWorkersPaused = storedState === 'true';

    const queuesPaused = await this.areQueuesPaused();

    const workerStatuses = await Promise.all(
      Array.from(this.workers.entries())
        .filter(([_, worker]) => worker !== undefined) // Filter out undefined workers
        .map(async ([name, worker]) => ({
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
      workersPaused: actualWorkersPaused,
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