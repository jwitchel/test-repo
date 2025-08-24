'use client';

import { JobsMonitor } from "@/components/jobs-monitor";
import { ImapLogViewer } from "@/components/imap-log-viewer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function JobsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [workersActive, setWorkersActive] = useState(false);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [queuesEmergencyPaused, setQueuesEmergencyPaused] = useState(false);
  const [isLoadingEmergency, setIsLoadingEmergency] = useState(false);
  const [queueStats, setQueueStats] = useState<{
    emailProcessing: { active: number; waiting: number; prioritized?: number; completed: number; failed: number; delayed: number; paused: number; isPaused?: boolean };
    toneProfile: { active: number; waiting: number; prioritized?: number; completed: number; failed: number; delayed: number; paused: number; isPaused?: boolean };
  }>({
    emailProcessing: { active: 0, waiting: 0, prioritized: 0, completed: 0, failed: 0, delayed: 0, paused: 0, isPaused: false },
    toneProfile: { active: 0, waiting: 0, prioritized: 0, completed: 0, failed: 0, delayed: 0, paused: 0, isPaused: false }
  });
  const { success, error } = useToast();
  
  
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    success('Jobs list refreshed');
  };

  const handleQueueEmailJob = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      
      // Get the first email account
      const accountsResponse = await fetch(`${apiUrl}/api/email-accounts`, {
        credentials: 'include'
      });
      
      if (!accountsResponse.ok) {
        error('Please add an email account first');
        return;
      }
      
      const accounts = await accountsResponse.json();
      if (!accounts || accounts.length === 0) {
        error('Please add an email account first');
        return;
      }
      
      const firstAccount = accounts[0];
      
      // Queue an email processing job
      const response = await fetch(`${apiUrl}/api/jobs/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          type: 'process-inbox',
          data: {
            accountId: firstAccount.id,
            folderName: 'INBOX'
          },
          priority: 'normal'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        success(`Email processing job queued: ${data.jobId}`);
        setRefreshKey(prev => prev + 1);
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to queue email job');
      }
    } catch (err) {
      error('Failed to queue email job');
      console.error('Error queueing email job:', err);
    }
  };

  const handleQueueToneJob = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      
      // Get the first email account
      const accountsResponse = await fetch(`${apiUrl}/api/email-accounts`, {
        credentials: 'include'
      });
      
      if (!accountsResponse.ok) {
        error('Please add an email account first');
        return;
      }
      
      const accounts = await accountsResponse.json();
      if (!accounts || accounts.length === 0) {
        error('Please add an email account first');
        return;
      }
      
      const firstAccount = accounts[0];
      
      // Queue a tone profile job
      const response = await fetch(`${apiUrl}/api/jobs/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          type: 'build-tone-profile',
          data: {
            accountId: firstAccount.id,
            historyDays: 30
          },
          priority: 'high'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        success(`Tone profile job queued: ${data.jobId}`);
        setRefreshKey(prev => prev + 1);
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to queue tone job');
      }
    } catch (err) {
      error('Failed to queue tone job');
      console.error('Error queueing tone job:', err);
    }
  };
  
  const handleWorkersToggle = async (enabled: boolean) => {
    setIsLoadingWorkers(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      
      const endpoint = enabled ? '/api/workers/resume' : '/api/workers/pause';
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setWorkersActive(!data.status?.workersPaused);
        success(data.message);
        setRefreshKey(prev => prev + 1);
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to toggle workers');
      }
    } catch (err) {
      error('Failed to toggle workers');
      console.error('Error toggling workers:', err);
    } finally {
      setIsLoadingWorkers(false);
    }
  };
  
  const handleEmergencyToggle = async () => {
    setIsLoadingEmergency(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      
      const endpoint = queuesEmergencyPaused 
        ? '/api/workers/resume-queues' 
        : '/api/workers/emergency-pause';
      
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setQueuesEmergencyPaused(!queuesEmergencyPaused);
        success(data.message);
        setRefreshKey(prev => prev + 1);
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to toggle emergency pause');
      }
    } catch (err) {
      error('Failed to toggle emergency pause');
      console.error('Error toggling emergency pause:', err);
    } finally {
      setIsLoadingEmergency(false);
    }
  };
  
  const handleClearQueue = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/jobs/clear-all-queues`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        success(`Cleared ${data.cleared || 0} jobs from all queues`);
        setRefreshKey(prev => prev + 1);
        // Refresh stats after clearing
        fetchStats();
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to clear all queues');
      }
    } catch (err) {
      error('Failed to clear all queues');
      console.error('Error clearing all queues:', err);
    }
  };
  
  // Fetch stats
  const fetchStats = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/jobs/stats`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        
        // Update queue-specific stats if available
        if (data.queues) {
          setQueueStats({
            emailProcessing: data.queues.emailProcessing || { active: 0, waiting: 0, prioritized: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
            toneProfile: data.queues.toneProfile || { active: 0, waiting: 0, prioritized: 0, completed: 0, failed: 0, delayed: 0, paused: 0 }
          });
        }
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Check worker status and fetch stats on mount
  useEffect(() => {
    const checkWorkerStatus = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
        const response = await fetch(`${apiUrl}/api/workers/status`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setWorkersActive(!data.workersPaused);
          setQueuesEmergencyPaused(data.queuesPaused);
        }
      } catch (err) {
        console.error('Error checking worker status:', err);
      }
    };
    checkWorkerStatus();
    fetchStats();
  }, []);
  
  // Refresh stats when refreshKey changes
  useEffect(() => {
    fetchStats();
  }, [refreshKey]);
  
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-zinc-900">Background Jobs</h1>
          <p className="text-zinc-600 mt-1">Monitor and manage background processing tasks</p>
        </div>
        
        {/* Single row with queue stats and controls */}
        <div className="flex gap-2 items-center">
          {/* Email Queue Stats */}
          <div className="border border-zinc-200 rounded-md px-2 py-1 bg-white">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-600">Email:</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-indigo-600 font-semibold" title="Active - Currently processing">{queueStats.emailProcessing.active}</span>
                <span className="text-xs text-zinc-400">/</span>
                <span className="text-xs text-zinc-600" title="Queued - Waiting to process">{(queueStats.emailProcessing.waiting || 0) + (queueStats.emailProcessing.prioritized || 0)}</span>
                <span className="text-xs text-zinc-400">/</span>
                <span className="text-xs text-green-600" title="Completed - Successfully processed">{queueStats.emailProcessing.completed}</span>
                <span className="text-xs text-zinc-400">/</span>
                <span className="text-xs text-red-600" title="Failed - Encountered errors">{queueStats.emailProcessing.failed}</span>
              </div>
            </div>
          </div>
          
          {/* Tone Queue Stats */}
          <div className="border border-zinc-200 rounded-md px-2 py-1 bg-white">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-600">Tone:</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-indigo-600 font-semibold" title="Active - Currently processing">{queueStats.toneProfile.active}</span>
                <span className="text-xs text-zinc-400">/</span>
                <span className="text-xs text-zinc-600" title="Queued - Waiting to process">{(queueStats.toneProfile.waiting || 0) + (queueStats.toneProfile.prioritized || 0)}</span>
                <span className="text-xs text-zinc-400">/</span>
                <span className="text-xs text-green-600" title="Completed - Successfully processed">{queueStats.toneProfile.completed}</span>
                <span className="text-xs text-zinc-400">/</span>
                <span className="text-xs text-red-600" title="Failed - Encountered errors">{queueStats.toneProfile.failed}</span>
              </div>
            </div>
          </div>
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Controls */}
          <div className="flex gap-1 items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="workers-toggle" className="text-sm font-medium text-zinc-700">
                Workers
              </label>
              <Switch
                id="workers-toggle"
                checked={workersActive}
                onCheckedChange={handleWorkersToggle}
                disabled={isLoadingWorkers}
              />
            </div>
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              className="hover:bg-zinc-50 h-7 px-2"
              title="Refresh stats"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button 
              onClick={handleQueueEmailJob}
              className="bg-purple-600 hover:bg-purple-700 h-7 px-2 text-xs"
              title="Queue Email Processing Job"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Email
            </Button>
            <Button 
              onClick={handleQueueToneJob}
              className="bg-indigo-600 hover:bg-indigo-700 h-7 px-2 text-xs"
              title="Queue Tone Profile Job"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Tone
            </Button>
            <Button
              onClick={handleEmergencyToggle}
              disabled={isLoadingEmergency}
              className={queuesEmergencyPaused 
                ? "bg-green-600 hover:bg-green-700 h-7 px-2 text-xs" 
                : "bg-red-600 hover:bg-red-700 h-7 px-2 text-xs"}
              title={queuesEmergencyPaused 
                ? "Resume all queues" 
                : "Emergency stop - pause all queues immediately"}
            >
              {queuesEmergencyPaused ? "Resume" : "Stop"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline"
                  className="hover:bg-red-50 border-red-200 text-red-600 hover:text-red-700 h-7 px-2 text-xs"
                  title="Clear all jobs from all queues"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Queues</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to clear all jobs from all queues? This will remove all jobs (waiting, active, completed, failed, delayed, and paused) from both the Email Processing and Tone Profile queues. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearQueue} className="bg-red-600 hover:bg-red-700">
                    Clear All Queues
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
      
      <JobsMonitor key={refreshKey} />
      
      {/* Real-Time Logs Panel */}
      <div className="mt-6">
        <ImapLogViewer 
          emailAccountId="monitoring"
          className="h-[400px]"
        />
      </div>
    </div>
  );
}