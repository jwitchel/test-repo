import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';

// Redis connection configuration
const connection = new Redis({
  host: 'localhost',
  port: 6380,
  maxRetriesPerRequest: null
});

// Simple job options - no retry logic as requested
const defaultJobOptions = {
  removeOnComplete: {
    count: 100,  // Keep last 100 completed jobs
    age: 3600    // Remove completed jobs older than 1 hour
  },
  removeOnFail: {
    count: 50,   // Keep last 50 failed jobs
    age: 7200    // Remove failed jobs older than 2 hours
  },
  attempts: 1    // No retries
};

// Job types enum
export enum JobType {
  BUILD_TONE_PROFILE = 'build-tone-profile',
  PROCESS_INBOX = 'process-inbox',
  LEARN_FROM_EDIT = 'learn-from-edit'
}

// Job priority levels
export enum JobPriority {
  LOW = 10,
  NORMAL = 5,
  HIGH = 3,
  CRITICAL = 1
}

// Type definitions for job data
export interface BuildToneProfileJobData {
  userId: string;
  accountId: string;
  historyDays?: number;
}

export interface ProcessInboxJobData {
  userId: string;
  accountId: string;
  folderName?: string; // Default to INBOX
  since?: Date; // Optional: only process emails after this date
}

export interface LearnFromEditJobData {
  userId: string;
  originalDraft: string;
  editedDraft: string;
  context?: {
    recipient?: string;
    subject?: string;
  };
}

// Create queues
export const emailProcessingQueue = new Queue('email-processing', {
  connection,
  defaultJobOptions
});

export const toneProfileQueue = new Queue('tone-profile', {
  connection,
  defaultJobOptions
});

// Helper functions to add jobs
export async function addEmailJob(
  type: JobType,
  data: ProcessInboxJobData | LearnFromEditJobData,
  priority: JobPriority = JobPriority.NORMAL
): Promise<Job> {
  return emailProcessingQueue.add(type, data, { priority });
}

export async function addToneProfileJob(
  data: BuildToneProfileJobData,
  priority: JobPriority = JobPriority.NORMAL
): Promise<Job> {
  return toneProfileQueue.add(JobType.BUILD_TONE_PROFILE, data, { priority });
}