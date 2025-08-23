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
  type: string;
  status: 'queued' | 'waiting' | 'prioritized' | 'active' | 'completed' | 'failed' | 'cancelled';
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

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function JobCard({ job, onRetry }: { job: JobData; onRetry: (jobId: string) => void }) {
  const statusConfig = {
    queued: { variant: 'secondary' as const, icon: Clock, color: 'text-zinc-500' },
    waiting: { variant: 'secondary' as const, icon: Clock, color: 'text-zinc-500' },
    prioritized: { variant: 'secondary' as const, icon: Clock, color: 'text-zinc-500' },
    active: { variant: 'default' as const, icon: Loader2, color: 'text-indigo-600' },
    completed: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' },
    failed: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
    cancelled: { variant: 'secondary' as const, icon: XCircle, color: 'text-zinc-400' }
  };
  
  const config = statusConfig[job.status];
  const Icon = config.icon;
  
  const jobTypeDisplay = {
    'build-tone-profile': 'Tone Profile Builder',
    'process-new-email': 'Process New Email',
    'monitor-inbox': 'Inbox Monitor',
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
            onClick={() => onRetry(job.jobId)}
            className="h-5 px-1.5 text-[10px] hover:bg-zinc-100"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function JobsMonitor() {
  const [jobs, setJobs] = useState<Map<string, JobData>>(new Map());
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Load initial jobs from API
  useEffect(() => {
    async function loadJobs() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
        const response = await fetch(`${apiUrl}/api/jobs/list`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          const jobsMap = new Map<string, JobData>();
          
          for (const job of data.jobs) {
            jobsMap.set(job.jobId, {
              jobId: job.jobId,
              type: job.type,
              status: job.status,
              progress: job.progress,
              result: job.result,
              error: job.error,
              timestamp: job.createdAt,
              duration: job.duration,
              startedAt: job.startedAt,
              completedAt: job.completedAt
            });
          }
          
          setJobs(jobsMap);
        }
      } catch (error) {
        console.error('Failed to load jobs:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadJobs();
  }, []);
  
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
          setJobs(prev => {
            const newJobs = new Map(prev);
            const existingJob = newJobs.get(event.jobId) || {} as JobData;
            
            switch (event.type) {
              case 'JOB_QUEUED':
                newJobs.set(event.jobId, {
                  ...existingJob,
                  jobId: event.jobId,
                  type: event.jobType || existingJob.type,
                  status: 'queued',
                  timestamp: event.timestamp || new Date().toISOString(),
                  priority: event.priority
                });
                break;
                
              case 'JOB_ACTIVE':
                newJobs.set(event.jobId, {
                  ...existingJob,
                  status: 'active',
                  startedAt: event.startedAt || new Date().toISOString()
                });
                break;
                
              case 'JOB_PROGRESS':
                newJobs.set(event.jobId, {
                  ...existingJob,
                  status: 'active',
                  progress: event.progress
                });
                break;
                
              case 'JOB_COMPLETED':
                newJobs.set(event.jobId, {
                  ...existingJob,
                  status: 'completed',
                  result: event.result,
                  completedAt: new Date().toISOString()
                });
                break;
                
              case 'JOB_FAILED':
                newJobs.set(event.jobId, {
                  ...existingJob,
                  status: 'failed',
                  error: event.error,
                  completedAt: event.failedAt || new Date().toISOString()
                });
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
  
  
  const handleRetry = async (jobId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/jobs/${jobId}/retry`, {
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