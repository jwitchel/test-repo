'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface JobProgress {
  current: number;
  total: number;
  percentage: number;
  currentTask: string;
}

interface JobData {
  jobId: string;
  queueName: string;
  type: string;
  status: 'queued' | 'waiting' | 'prioritized' | 'delayed' | 'paused' | 'active' | 'completed' | 'failed' | 'cancelled' | string;
  progress?: JobProgress;
  result?: {
    profilesCreated?: number;
    emailsAnalyzed?: number;
    emailsProcessed?: number;
  };
  error?: string;
  timestamp: string;
  duration?: number;
  priority?: string;
  startedAt?: string;
  completedAt?: string;
}

interface ApiJobData {
  jobId: string;
  queueName: string;
  type: string;
  status: 'queued' | 'waiting' | 'prioritized' | 'delayed' | 'paused' | 'active' | 'completed' | 'failed' | 'cancelled' | string;
  progress?: JobProgress;
  result?: {
    profilesCreated?: number;
    emailsAnalyzed?: number;
    emailsProcessed?: number;
  };
  error?: string;
  createdAt: string;
  duration?: number;
  priority?: string;
  processedAt?: string | null;
  completedAt?: string | null;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function convertApiJobToJobData(apiJob: ApiJobData): JobData {
  return {
    jobId: apiJob.jobId,
    queueName: apiJob.queueName,
    type: apiJob.type,
    status: apiJob.status,
    progress: apiJob.progress,
    result: apiJob.result,
    error: apiJob.error,
    timestamp: apiJob.createdAt,
    duration: apiJob.duration,
    startedAt: apiJob.processedAt || undefined,
    completedAt: apiJob.completedAt || undefined
  };
}

function JobCard({ job, onRetry }: { job: JobData; onRetry: (jobId: string, queueName: string) => void }) {
  const statusConfig = {
    queued: { variant: 'secondary' as const, icon: Clock, color: 'text-zinc-500' },
    waiting: { variant: 'secondary' as const, icon: Clock, color: 'text-zinc-500' },
    prioritized: { variant: 'secondary' as const, icon: Clock, color: 'text-zinc-500' },
    delayed: { variant: 'secondary' as const, icon: Clock, color: 'text-orange-500' },
    paused: { variant: 'secondary' as const, icon: Clock, color: 'text-yellow-500' },
    active: { variant: 'default' as const, icon: Loader2, color: 'text-indigo-600' },
    completed: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
    failed: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
    cancelled: { variant: 'secondary' as const, icon: XCircle, color: 'text-zinc-400' }
  };

  // Provide a default config for unknown statuses
  const config = statusConfig[job.status] || {
    variant: 'secondary' as const,
    icon: Clock,
    color: 'text-zinc-400'
  };
  const Icon = config.icon;
  
  const jobTypeDisplay = {
    'build-tone-profile': 'Tone Profile Builder',
    'process-inbox': 'Process Inbox',
    'learn-from-edit': 'Learn From Edit'
  }[job.type] || job.type;
  
  return (
    <div className="flex items-center justify-between py-1.5 px-2 border-b border-zinc-100 hover:bg-zinc-50 text-xs">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Icon className={`h-3 w-3 ${config.color} ${job.status === 'active' ? 'animate-spin' : ''} flex-shrink-0`} />
        <span className="font-medium truncate">{jobTypeDisplay}</span>
        <Badge variant={config.variant} className="text-[10px] px-1.5 py-0 h-4">{job.status}</Badge>
        {job.priority && job.priority !== 'normal' && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {job.priority}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] text-zinc-500">{formatTimestamp(job.timestamp)}</span>
        {job.status === 'failed' && (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => onRetry(job.jobId, job.queueName)}
            className="h-5 px-1.5 text-[10px] hover:bg-zinc-100"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface JobsMonitorProps {
  refreshTrigger?: number;
  forceRefresh?: boolean;
  onJobComplete?: () => void;
}

export function JobsMonitor({ refreshTrigger, forceRefresh, onJobComplete }: JobsMonitorProps) {
  const [jobs, setJobs] = useState<Map<string, JobData>>(new Map());
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const loadJobsRef = useRef<((forceReplace?: boolean) => Promise<void>) | undefined>(undefined);
  const pendingLoadJobs = useRef<Set<string>>(new Set()); // Track pending loadJobs calls
  
  // Load jobs from API - memoized to be called from multiple places
  const loadJobs = async (forceReplace: boolean = false) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/jobs/list`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[JobsMonitor] loadJobs - received ${data.jobs.length} jobs:`, 
          data.jobs.map((j: ApiJobData) => `${j.type}(${j.queueName}):${j.status}[${j.jobId}]`));
        
        if (forceReplace) {
          // Replace all jobs with API data (used for refresh after clear operations)
          console.log(`[JobsMonitor] loadJobs - force replacing all jobs with API data`);
          const newJobs = new Map<string, JobData>();
          
          for (const apiJob of data.jobs) {
            const jobKey = `${apiJob.queueName}:${apiJob.jobId}`;
            const jobData = convertApiJobToJobData(apiJob);
            newJobs.set(jobKey, jobData);
          }
          
          setJobs(newJobs);
          console.log(`[JobsMonitor] loadJobs - replaced with ${newJobs.size} jobs from API`);
        } else {
          // Merge API data with existing WebSocket state (normal operation)
          setJobs(prevJobs => {
            const newJobs = new Map(prevJobs);
            
            for (const apiJob of data.jobs) {
              // Use composite key: queueName:jobId to handle job ID reuse across queues
              const jobKey = `${apiJob.queueName}:${apiJob.jobId}`;
              const existing = newJobs.get(jobKey);
              const jobData = convertApiJobToJobData(apiJob);
              
              // Prefer existing WebSocket data for active jobs, API data for others
              if (!existing || existing.status === 'queued' || apiJob.status !== 'queued') {
                newJobs.set(jobKey, jobData);
              }
            }
            
            console.log(`[JobsMonitor] loadJobs - merged state, now have ${newJobs.size} total jobs`);
            return newJobs;
          });
        }
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Store loadJobs ref for use in WebSocket handler
  loadJobsRef.current = loadJobs;
  
  // Load initial jobs from API and when refresh is triggered
  useEffect(() => {
    loadJobs(forceRefresh);
  }, [refreshTrigger, forceRefresh]);
  
  // Set up WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, '') || 'localhost:3002';
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log('JobsMonitor: Connecting to WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('JobsMonitor: WebSocket connected');
      setIsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle job events from unified WebSocket
        if (data.type === 'job-event' && data.data) {
          const event = data.data;
          console.log(`[JobsMonitor] WebSocket event:`, event.type, event.jobId, event.queueName, event.jobType);
          
          setJobs(prev => {
            const newJobs = new Map(prev);
            // Use composite key: queueName:jobId to handle job ID reuse across queues
            const jobKey = `${event.queueName}:${event.jobId}`;
            const existingJob = newJobs.get(jobKey) || {} as JobData;
            
            switch (event.type) {
              case 'JOB_QUEUED':
                console.log(`[JobsMonitor] JOB_QUEUED - existing:`, !!existingJob.jobId, 'queue:', event.queueName);
                // Always update the job in our state immediately
                newJobs.set(jobKey, {
                  ...existingJob,
                  jobId: event.jobId,
                  queueName: event.queueName || existingJob.queueName,
                  type: event.jobType || existingJob.type,
                  status: 'queued',
                  timestamp: event.timestamp || new Date().toISOString(),
                  priority: event.priority
                });
                
                // For completely new jobs, also fetch full details from API (with deduplication)
                if (!existingJob.jobId && loadJobsRef.current && !pendingLoadJobs.current.has(jobKey)) {
                  console.log(`[JobsMonitor] Scheduling loadJobs for new job:`, jobKey);
                  pendingLoadJobs.current.add(jobKey);
                  
                  // Delay slightly to ensure job is fully persisted in Redis
                  setTimeout(() => {
                    console.log(`[JobsMonitor] Calling loadJobs for job:`, jobKey);
                    pendingLoadJobs.current.delete(jobKey);
                    loadJobsRef.current!();
                  }, 200);
                }
                break;
                
              case 'JOB_ACTIVE':
                newJobs.set(jobKey, {
                  ...existingJob,
                  queueName: event.queueName || existingJob.queueName,
                  status: 'active',
                  startedAt: event.startedAt || new Date().toISOString()
                });
                break;
                
              case 'JOB_PROGRESS':
                newJobs.set(jobKey, {
                  ...existingJob,
                  queueName: event.queueName || existingJob.queueName,
                  status: 'active',
                  progress: event.progress
                });
                break;
                
              case 'JOB_COMPLETED':
                console.log(`[JobsMonitor] JOB_COMPLETED - existing:`, !!existingJob.jobId, 'queue:', event.queueName);
                newJobs.set(jobKey, {
                  ...existingJob,
                  queueName: event.queueName || existingJob.queueName,
                  status: 'completed',
                  result: event.result,
                  completedAt: new Date().toISOString()
                });
                // Trigger stats refresh when a job completes
                if (onJobComplete) {
                  onJobComplete();
                }
                break;
                
              case 'JOB_FAILED':
                console.log(`[JobsMonitor] JOB_FAILED - existing:`, !!existingJob.jobId, 'queue:', event.queueName);
                newJobs.set(jobKey, {
                  ...existingJob,
                  queueName: event.queueName || existingJob.queueName,
                  status: 'failed',
                  error: event.error,
                  completedAt: event.failedAt || new Date().toISOString()
                });
                // Trigger stats refresh when a job fails
                if (onJobComplete) {
                  onJobComplete();
                }
                break;
                
              case 'QUEUE_CLEARED':
                // Clear ALL jobs from the UI when queue is cleared
                return new Map();
            }
            
            return newJobs;
          });
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('JobsMonitor: WebSocket error:', error);
      setIsConnected(false);
    };
    
    ws.onclose = () => {
      console.log('JobsMonitor: WebSocket disconnected');
      setIsConnected(false);
    };
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []); // Empty dependency array - only connect once on mount
  
  
  const handleRetry = async (jobId: string, queueName: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/jobs/${queueName}/${jobId}/retry`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        // New job will be added via WebSocket
        console.log('Retrying job:', data);
      }
    } catch (error) {
      console.error('Failed to retry job:', error);
    }
  };
  
  const sortedJobs = useMemo(() => {
    return Array.from(jobs.values()).sort((a, b) => {
      // Sort by timestamp, newest first
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [jobs]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }
  
  return (
    <div>
      {/* Job List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Background Jobs</CardTitle>
              <CardDescription className="text-xs">Real-time status of all background processing</CardDescription>
            </div>
            {!loading && (
              <div className="flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-zinc-400'}`} />
                <span className="text-[10px] text-zinc-500">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[120px] overflow-y-auto">
            {sortedJobs.length > 0 ? (
              <div>
                {sortedJobs.slice(0, 20).map((job, index) => (
                  <JobCard 
                    key={`${job.jobId}-${job.timestamp}-${index}`} 
                    job={job} 
                    onRetry={handleRetry} 
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 text-sm">
                No background jobs yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}