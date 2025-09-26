/**
 * JobScheduler Manager
 * Manages BullMQ JobSchedulers for automated background tasks
 */

import Redis from 'ioredis';
import {
  inboxQueue,
  trainingQueue,
  JobType,
  JobPriority,
  ProcessInboxJobData,
  BuildToneProfileJobData
} from './queue';
import { Queue } from 'bullmq';

// Redis keys for storing scheduler state
const SCHEDULER_STATE_PREFIX = 'scheduler:';

// Scheduler IDs
export enum SchedulerId {
  CHECK_MAIL = 'check-mail',
  UPDATE_TONE = 'update-tone'
}

// Scheduler configuration
interface SchedulerConfig {
  id: SchedulerId;
  queue: Queue;
  interval: number;
  jobType: JobType;
  jobData: (userId: string, accountId: string) => ProcessInboxJobData | BuildToneProfileJobData;
  jobOpts: { priority: JobPriority };
  description: string;
}

export class JobSchedulerManager {
  private static instance: JobSchedulerManager;
  private redis: Redis;
  private schedulerConfigs: Map<string, SchedulerConfig> = new Map();

  private constructor() {
    this.redis = new Redis({
      host: 'localhost',
      port: 6380,
      maxRetriesPerRequest: null
    });

    // Initialize scheduler configurations
    this.initializeSchedulerConfigs();
  }

  static getInstance(): JobSchedulerManager {
    if (!JobSchedulerManager.instance) {
      JobSchedulerManager.instance = new JobSchedulerManager();
    }
    return JobSchedulerManager.instance;
  }

  private initializeSchedulerConfigs(): void {
    // Check Mail scheduler configuration
    this.schedulerConfigs.set(SchedulerId.CHECK_MAIL, {
      id: SchedulerId.CHECK_MAIL,
      queue: inboxQueue,
      interval: parseInt(process.env.CHECK_MAIL_INTERVAL || '60000'), // Default 60 seconds
      jobType: JobType.PROCESS_INBOX,
      jobData: (userId: string, accountId: string) => ({
        userId,
        accountId,
        folderName: 'INBOX'
      }),
      jobOpts: { priority: JobPriority.NORMAL },
      description: 'Check for new emails'
    });

    // Update Tone scheduler configuration
    this.schedulerConfigs.set(SchedulerId.UPDATE_TONE, {
      id: SchedulerId.UPDATE_TONE,
      queue: trainingQueue,
      interval: parseInt(process.env.UPDATE_TONE_INTERVAL || '86400000'), // Default 24 hours
      jobType: JobType.BUILD_TONE_PROFILE,
      jobData: (userId: string, accountId: string) => ({
        userId,
        accountId,
        historyDays: 30
      }),
      jobOpts: { priority: JobPriority.LOW },
      description: 'Update tone profile'
    });
  }

  /**
   * Enable a scheduler for a specific user and account
   */
  async enableScheduler(schedulerId: string, userId: string, accountId: string): Promise<void> {
    const config = this.schedulerConfigs.get(schedulerId);
    if (!config) {
      throw new Error(`Unknown scheduler: ${schedulerId}`);
    }

    console.log(`[JobSchedulerManager] Enabling scheduler: ${schedulerId} for user: ${userId}`);

    // Create or update the JobScheduler using BullMQ's native functionality
    // Note: JobScheduler ID includes userId to make it unique per user
    const jobSchedulerId = `${schedulerId}-${userId}`;

    await config.queue.upsertJobScheduler(
      jobSchedulerId,
      {
        every: config.interval // Repeat interval in milliseconds
      },
      {
        name: config.jobType,
        data: config.jobData(userId, accountId),
        opts: config.jobOpts
      }
    );

    // Store enabled state in Redis
    await this.redis.set(`${SCHEDULER_STATE_PREFIX}${jobSchedulerId}:enabled`, 'true');
    await this.redis.set(`${SCHEDULER_STATE_PREFIX}${jobSchedulerId}:accountId`, accountId);

    console.log(`[JobSchedulerManager] Scheduler ${schedulerId} enabled for user ${userId} with interval ${config.interval}ms`);
  }

  /**
   * Disable a scheduler for a specific user
   */
  async disableScheduler(schedulerId: string, userId: string): Promise<void> {
    const config = this.schedulerConfigs.get(schedulerId);
    if (!config) {
      throw new Error(`Unknown scheduler: ${schedulerId}`);
    }

    console.log(`[JobSchedulerManager] Disabling scheduler: ${schedulerId} for user: ${userId}`);

    // Remove the JobScheduler
    const jobSchedulerId = `${schedulerId}-${userId}`;
    await config.queue.removeJobScheduler(jobSchedulerId);

    // Update state in Redis
    await this.redis.set(`${SCHEDULER_STATE_PREFIX}${jobSchedulerId}:enabled`, 'false');

    console.log(`[JobSchedulerManager] Scheduler ${schedulerId} disabled for user ${userId}`);
  }

  /**
   * Get the status of a specific scheduler
   */
  async getSchedulerStatus(schedulerId: string, userId: string): Promise<{
    id: string;
    enabled: boolean;
    interval: number;
    description: string;
    accountId?: string;
    nextRun?: Date;
  }> {
    const config = this.schedulerConfigs.get(schedulerId);
    if (!config) {
      throw new Error(`Unknown scheduler: ${schedulerId}`);
    }

    const jobSchedulerId = `${schedulerId}-${userId}`;

    // Get enabled state from Redis
    const enabledStr = await this.redis.get(`${SCHEDULER_STATE_PREFIX}${jobSchedulerId}:enabled`);
    const enabled = enabledStr === 'true';

    // Get account ID from Redis
    const accountId = await this.redis.get(`${SCHEDULER_STATE_PREFIX}${jobSchedulerId}:accountId`);

    // Get scheduler details from BullMQ if enabled
    let nextRun: Date | undefined;
    if (enabled) {
      try {
        const schedulers = await config.queue.getJobSchedulers();
        const scheduler = schedulers.find(s => s.id === jobSchedulerId);
        if (scheduler && scheduler.next) {
          nextRun = new Date(scheduler.next);
        }
      } catch (error) {
        console.error(`Error getting scheduler details for ${jobSchedulerId}:`, error);
      }
    }

    return {
      id: schedulerId,
      enabled,
      interval: config.interval,
      description: config.description,
      accountId: accountId || undefined,
      nextRun
    };
  }

  /**
   * Get status of all schedulers for a user
   */
  async getAllSchedulerStatuses(userId: string): Promise<Array<{
    id: string;
    enabled: boolean;
    interval: number;
    description: string;
    accountId?: string;
    nextRun?: Date;
  }>> {
    const statuses = [];

    for (const schedulerId of this.schedulerConfigs.keys()) {
      const status = await this.getSchedulerStatus(schedulerId, userId);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Initialize schedulers for a user (restore state from Redis)
   */
  async initializeUserSchedulers(userId: string): Promise<void> {
    console.log(`[JobSchedulerManager] Initializing schedulers for user: ${userId}`);

    for (const [schedulerId] of this.schedulerConfigs.entries()) {
      const jobSchedulerId = `${schedulerId}-${userId}`;
      const enabledStr = await this.redis.get(`${SCHEDULER_STATE_PREFIX}${jobSchedulerId}:enabled`);
      const accountId = await this.redis.get(`${SCHEDULER_STATE_PREFIX}${jobSchedulerId}:accountId`);

      if (enabledStr === 'true' && accountId) {
        try {
          // Re-enable the scheduler if it was previously enabled
          await this.enableScheduler(schedulerId, userId, accountId);
          console.log(`[JobSchedulerManager] Restored scheduler ${schedulerId} for user ${userId}`);
        } catch (error) {
          console.error(`[JobSchedulerManager] Failed to restore scheduler ${schedulerId} for user ${userId}:`, error);
        }
      }
    }
  }

  /**
   * Clean up all schedulers for a user
   */
  async cleanupUserSchedulers(userId: string): Promise<void> {
    console.log(`[JobSchedulerManager] Cleaning up schedulers for user: ${userId}`);

    for (const schedulerId of this.schedulerConfigs.keys()) {
      try {
        await this.disableScheduler(schedulerId, userId);
      } catch (error) {
        console.error(`[JobSchedulerManager] Error disabling scheduler ${schedulerId} for user ${userId}:`, error);
      }
    }
  }

  /**
   * Close connections (for graceful shutdown)
   */
  async shutdown(): Promise<void> {
    console.log('[JobSchedulerManager] Shutting down...');
    await this.redis.quit();
    console.log('[JobSchedulerManager] Shutdown complete');
  }
}

// Export singleton instance
export const jobSchedulerManager = JobSchedulerManager.getInstance();