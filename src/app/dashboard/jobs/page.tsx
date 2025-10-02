'use client';

import { JobsMonitor } from "@/components/jobs-monitor";
import { ImapLogViewer } from "@/components/imap-log-viewer";
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
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export default function JobsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [workersActive, setWorkersActive] = useState(false);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [queuesEmergencyPaused, setQueuesEmergencyPaused] = useState(false);
  const [isLoadingEmergency, setIsLoadingEmergency] = useState(false);
  const [schedulers, setSchedulers] = useState<Array<{
    id: string;
    enabled: boolean;
    interval: number;
    description: string;
    accountId: string;
    nextRun?: string;
  }>>([]);
  const [isLoadingSchedulers, setIsLoadingSchedulers] = useState(false);
  const [queueStats, setQueueStats] = useState<{
    emailProcessing: { active: number; waiting: number; prioritized?: number; completed: number; failed: number; delayed: number; paused: number; isPaused?: boolean };
    toneProfile: { active: number; waiting: number; prioritized?: number; completed: number; failed: number; delayed: number; paused: number; isPaused?: boolean };
  }>({
    emailProcessing: { active: 0, waiting: 0, prioritized: 0, completed: 0, failed: 0, delayed: 0, paused: 0, isPaused: false },
    toneProfile: { active: 0, waiting: 0, prioritized: 0, completed: 0, failed: 0, delayed: 0, paused: 0, isPaused: false }
  });
  const { success, error } = useToast();
  
  // API URL used throughout the component
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  
  // Shared method for consistent API request handling
  const handleApiRequest = async (config: {
    endpoint: string;
    method?: string;
    body?: unknown;
    loadingStateSetter?: (loading: boolean) => void;
    onSuccess?: (data: Record<string, unknown>) => void;
    onError?: (errorData: Record<string, unknown>) => void;
    defaultErrorMessage: string;
    logPrefix: string;
    refreshAfter?: boolean;
  }) => {
    const { 
      endpoint, 
      method = 'POST', 
      body, 
      loadingStateSetter, 
      onSuccess, 
      onError,
      defaultErrorMessage, 
      logPrefix,
      refreshAfter = true 
    } = config;

    if (loadingStateSetter) loadingStateSetter(true);
    
    try {
      const requestOptions: RequestInit = {
        method,
        credentials: 'include'
      };
      
      if (body) {
        requestOptions.headers = { 'Content-Type': 'application/json' };
        requestOptions.body = JSON.stringify(body);
      }
      
      const response = await fetch(`${apiUrl}${endpoint}`, requestOptions);
      
      if (response.ok) {
        const data = await response.json();
        if (onSuccess) {
          onSuccess(data);
        } else {
          success(data.message || 'Operation completed successfully');
        }
        if (refreshAfter) {
          setRefreshKey(prev => prev + 1);
        }
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || defaultErrorMessage;
        if (onError) {
          onError(errorData);
        } else {
          error(errorMessage);
        }
      }
    } catch (err) {
      error(defaultErrorMessage);
      console.error(`${logPrefix}:`, err);
    } finally {
      if (loadingStateSetter) loadingStateSetter(false);
    }
  };
  
  const handleRefresh = () => {
    setForceRefresh(true);
    setRefreshKey(prev => prev + 1);
    success('Jobs list refreshed');
  };

  const queueJob = async (jobConfig: {
    type: string;
    data: Record<string, unknown>;
    priority: string;
    successMessage: string;
    errorMessage: string;
    logMessage: string;
  }) => {
    try {
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
      
      // Queue the job
      const response = await fetch(`${apiUrl}/api/jobs/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          type: jobConfig.type,
          data: {
            accountId: firstAccount.id,
            ...jobConfig.data
          },
          priority: jobConfig.priority
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        success(`${jobConfig.successMessage}: ${data.jobId}`);
        // Trigger refresh to show the new job
        setTimeout(() => setRefreshKey(prev => prev + 1), 300);
      } else {
        const errorData = await response.json();
        error(errorData.error || jobConfig.errorMessage);
      }
    } catch (err) {
      error(jobConfig.errorMessage);
      console.error(jobConfig.logMessage, err);
    }
  };

  const handleQueueEmailJob = async () => {
    await queueJob({
      type: 'process-inbox',
      data: {
        folderName: 'INBOX'
      },
      priority: 'normal',
      successMessage: 'Email processing job queued',
      errorMessage: 'Failed to queue email job',
      logMessage: 'Error queueing email job:'
    });
  };

  const handleQueueToneJob = async () => {
    await queueJob({
      type: 'build-tone-profile',
      data: {
        historyDays: 30
      },
      priority: 'high',
      successMessage: 'Tone profile job queued',
      errorMessage: 'Failed to queue tone job',
      logMessage: 'Error queueing tone job:'
    });
  };

  const handleProcessInbox = async () => {
    try {
      // Get first account - this is just a quick test button
      const response = await fetch(`${apiUrl}/api/email-accounts`, {
        credentials: 'include'
      });

      if (!response.ok) {
        error('Please add an email account first');
        return;
      }

      const accounts = await response.json();
      if (!accounts || accounts.length === 0) {
        error('Please add an email account first');
        return;
      }

      // Queue job for first account
      await queueJob({
        type: 'process-inbox',
        data: {
          accountId: accounts[0].id,
          folderName: 'INBOX'
        },
        priority: 'high',
        successMessage: `Inbox processing queued for ${accounts[0].email_address}`,
        errorMessage: 'Failed to queue inbox processing',
        logMessage: 'Error queueing inbox processing:'
      });
    } catch (err) {
      error('Failed to queue inbox processing');
      console.error('Error:', err);
    }
  };
  
  const handleWorkersToggle = async (enabled: boolean) => {
    const endpoint = enabled ? '/api/workers/resume' : '/api/workers/pause';
    
    await handleApiRequest({
      endpoint,
      loadingStateSetter: setIsLoadingWorkers,
      onSuccess: (data) => {
        const statusData = data.status as { workersPaused?: boolean };
        setWorkersActive(!statusData?.workersPaused);
        success(data.message as string);
      },
      defaultErrorMessage: 'Failed to toggle workers',
      logPrefix: 'Error toggling workers'
    });
  };
  
  const handleEmergencyToggle = async () => {
    const endpoint = queuesEmergencyPaused
      ? '/api/workers/resume-queues'
      : '/api/workers/emergency-pause';

    await handleApiRequest({
      endpoint,
      loadingStateSetter: setIsLoadingEmergency,
      onSuccess: (data) => {
        setQueuesEmergencyPaused(!queuesEmergencyPaused);
        success(data.message as string);
      },
      defaultErrorMessage: 'Failed to toggle emergency pause',
      logPrefix: 'Error toggling emergency pause'
    });
  };

  const handleClearQueue = async () => {
    await handleApiRequest({
      endpoint: '/api/jobs/clear-pending-jobs',
      onSuccess: (data) => {
        success(`Cleared ${data.cleared || 0} pending jobs (queued/prioritized)`);
        // Refresh stats after clearing
        fetchStats();
      },
      defaultErrorMessage: 'Failed to clear pending jobs',
      logPrefix: 'Error clearing pending jobs'
    });
  };

  const handleObliterateQueue = async () => {
    await handleApiRequest({
      endpoint: '/api/jobs/clear-all-queues',
      onSuccess: (data) => {
        success(`Obliterated ${data.cleared || 0} jobs from all queues`);
        // Refresh stats after clearing
        fetchStats();
      },
      defaultErrorMessage: 'Failed to obliterate all queues',
      logPrefix: 'Error obliterating all queues'
    });
  };
  
  // Fetch stats
  const fetchStats = useCallback(async () => {
    await handleApiRequest({
      endpoint: '/api/jobs/stats',
      method: 'GET',
      onSuccess: (data) => {
        // Update queue-specific stats if available
        if (data.queues) {
          const queues = data.queues as {
            emailProcessing?: { active: number; waiting: number; prioritized?: number; completed: number; failed: number; delayed: number; paused: number; isPaused?: boolean };
            toneProfile?: { active: number; waiting: number; prioritized?: number; completed: number; failed: number; delayed: number; paused: number; isPaused?: boolean };
          };
          setQueueStats({
            emailProcessing: queues.emailProcessing || { active: 0, waiting: 0, prioritized: 0, completed: 0, failed: 0, delayed: 0, paused: 0 },
            toneProfile: queues.toneProfile || { active: 0, waiting: 0, prioritized: 0, completed: 0, failed: 0, delayed: 0, paused: 0 }
          });
        }
      },
      onError: () => {
        // Silent error handling for stats - don't show toast
      },
      defaultErrorMessage: 'Failed to fetch stats',
      logPrefix: 'Error fetching stats',
      refreshAfter: false
    });
  }, [handleApiRequest]);

  // Fetch scheduler status
  const fetchSchedulers = useCallback(async () => {
    await handleApiRequest({
      endpoint: '/api/schedulers',
      method: 'GET',
      onSuccess: (data) => {
        const schedulerData = data as { schedulers?: Array<{
          id: string;
          enabled: boolean;
          interval: number;
          description: string;
          accountId: string;
          nextRun?: string;
        }> };
        setSchedulers(schedulerData.schedulers || []);
      },
      onError: () => {
        // Silent error handling for schedulers - don't show toast
      },
      defaultErrorMessage: 'Failed to fetch schedulers',
      logPrefix: 'Error fetching schedulers',
      refreshAfter: false
    });
  }, [handleApiRequest]);

  // Handle scheduler toggle
  const handleSchedulerToggle = async (schedulerId: string, accountId: string, enabled: boolean) => {
    await handleApiRequest({
      endpoint: `/api/schedulers/${schedulerId}/${accountId}`,
      method: 'PUT',
      body: { enabled },
      loadingStateSetter: setIsLoadingSchedulers,
      onSuccess: (data) => {
        success(data.message as string);
        fetchSchedulers(); // Refresh scheduler list
        if (enabled) {
          // Refresh jobs to show newly scheduled ones
          setTimeout(() => setRefreshKey(prev => prev + 1), 500);
        }
      },
      defaultErrorMessage: `Failed to ${enabled ? 'enable' : 'disable'} scheduler`,
      logPrefix: 'Error toggling scheduler',
      refreshAfter: false
    });
  };

  // Check worker status and fetch stats on mount
  useEffect(() => {
    const checkWorkerStatus = async () => {
      await handleApiRequest({
        endpoint: '/api/workers/status',
        method: 'GET',
        onSuccess: (data) => {
          setWorkersActive(!(data.workersPaused as boolean));
          setQueuesEmergencyPaused(data.queuesPaused as boolean);
        },
        onError: () => {
          // Silent error handling for status check - don't show toast
        },
        defaultErrorMessage: 'Failed to check worker status',
        logPrefix: 'Error checking worker status',
        refreshAfter: false
      });
    };
    checkWorkerStatus();
    fetchStats();
    fetchSchedulers();
  }, []);
  
  // Refresh stats when refreshKey changes
  useEffect(() => {
    fetchStats();
  }, [refreshKey]);
  
  // Reset forceRefresh flag after it's been used
  useEffect(() => {
    if (forceRefresh) {
      const timer = setTimeout(() => {
        setForceRefresh(false);
      }, 100); // Reset after a short delay to ensure JobsMonitor processes it
      return () => clearTimeout(timer);
    }
  }, [forceRefresh]);
  
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-zinc-900">Background Jobs</h1>
          <p className="text-zinc-600 mt-1">Monitor and manage background processing tasks</p>
        </div>
        
        {/* Single row with queue stats and controls */}
        <div className="flex gap-2 items-start">
          {/* Queue Stats - aligned with Row 1 of controls */}
          <div className="flex flex-col gap-1">
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
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Controls - Split into two rows */}
          <div className="flex flex-col gap-1 items-end">
            {/* Row 1: Schedulers and Toggles */}
            <div className="flex gap-1 items-center">
            {/* Scheduler Toggles */}
            {schedulers.map(scheduler => {
              const intervalStr = scheduler.interval >= 3600000
                ? `${Math.round(scheduler.interval / 3600000)}h`
                : scheduler.interval >= 60000
                ? `${Math.round(scheduler.interval / 60000)}m`
                : `${Math.round(scheduler.interval / 1000)}s`;

              // Safely format next run time
              let nextRunStr = 'Not scheduled';
              if (scheduler.nextRun) {
                const nextRunDate = new Date(scheduler.nextRun);
                if (!isNaN(nextRunDate.getTime())) {
                  nextRunStr = `Next: ${nextRunDate.toLocaleTimeString()}`;
                }
              }

              return (
                <div key={scheduler.id} className="flex items-center gap-1 border border-zinc-200 rounded px-2 py-0.5">
                  <label
                    htmlFor={`scheduler-${scheduler.id}`}
                    className="text-xs font-medium text-zinc-600 cursor-pointer"
                    title={`${scheduler.description}\nInterval: every ${intervalStr}\n${nextRunStr}`}
                  >
                    {scheduler.id === 'check-mail' ? '📧' : '🎨'}
                    <span className="ml-1 text-zinc-500">{intervalStr}</span>
                  </label>
                  <Switch
                    id={`scheduler-${scheduler.id}`}
                    checked={scheduler.enabled}
                    onCheckedChange={(enabled) => handleSchedulerToggle(scheduler.id, scheduler.accountId, enabled)}
                    disabled={isLoadingSchedulers}
                    className="scale-75"
                  />
                </div>
              );
            })}
            <div className="w-px h-5 bg-zinc-300 mx-1" />
            <div className="flex items-center gap-1.5">
              <label htmlFor="workers-toggle" className="text-xs font-medium text-zinc-600">
                Workers
              </label>
              <Switch
                id="workers-toggle"
                checked={workersActive}
                onCheckedChange={handleWorkersToggle}
                disabled={isLoadingWorkers}
                className="scale-90"
              />
            </div>
            </div>

            {/* Row 2: Action Buttons */}
            <div className="flex gap-1 items-center">
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
              onClick={handleProcessInbox}
              className="bg-emerald-600 hover:bg-emerald-700 h-7 px-2 text-xs"
              title="Process all unprocessed emails - moves them to folders and marks as processed"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Process All
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
                  title="Clear pending jobs (queued/prioritized) from all queues"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Pending Jobs</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to clear pending jobs from all queues? This will remove jobs that haven&apos;t started processing yet (queued, prioritized, and delayed) from both the Email Processing and Tone Profile queues. Active, completed, and failed jobs will remain. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearQueue} className="bg-red-600 hover:bg-red-700">
                    Clear Pending Jobs
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline"
                  className="hover:bg-red-100 border-red-300 text-red-700 hover:text-red-800 h-7 px-2 text-xs font-semibold"
                  title="Obliterate ALL jobs from all queues (nuclear option)"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Obliterate
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-red-600">⚠️ Obliterate All Jobs</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2">
                      <div className="font-semibold text-red-700">DANGER: This is the nuclear option!</div>
                      <div>This will completely obliterate ALL jobs from ALL queues, including:</div>
                      <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                        <li>Waiting and prioritized jobs</li>
                        <li>Active jobs (currently processing)</li>
                        <li>Completed jobs (history)</li>
                        <li>Failed jobs (debugging info)</li>
                        <li>Delayed and paused jobs</li>
                      </ul>
                      <div className="font-semibold text-red-700">This action cannot be undone and will clear all job history!</div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleObliterateQueue} className="bg-red-700 hover:bg-red-800">
                    💥 Obliterate Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            </div>
          </div>
        </div>
      </div>
      
      <JobsMonitor refreshTrigger={refreshKey} forceRefresh={forceRefresh} onJobComplete={fetchStats} />
      
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