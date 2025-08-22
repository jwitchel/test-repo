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
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoadingMonitoring, setIsLoadingMonitoring] = useState(false);
  const [stats, setStats] = useState({ active: 0, queued: 0, completed: 0, failed: 0 });
  const { success, error } = useToast();
  
  
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    success('Jobs list refreshed');
  };
  
  const handleTestJob = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      
      // First get the user's email accounts
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
      
      // Use the first account for the test job
      const firstAccount = accounts[0];
      
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
            historyDays: 7
          },
          priority: 'normal'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        success(`Test job queued: ${data.jobId}`);
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to queue test job');
      }
    } catch (err) {
      error('Failed to queue test job');
      console.error('Error queueing test job:', err);
    }
  };
  
  const handleMonitoringToggle = async (enabled: boolean) => {
    setIsLoadingMonitoring(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      
      if (enabled) {
        const response = await fetch(`${apiUrl}/api/jobs/start-monitoring`, {
          method: 'POST',
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            success(`Started monitoring ${data.accountsMonitored} accounts`);
            setIsMonitoring(true);
          } else {
            error(data.message || 'Monitoring not started');
          }
          setRefreshKey(prev => prev + 1);
        } else {
          const errorData = await response.json();
          error(errorData.error || 'Failed to start monitoring');
        }
      } else {
        // For now, just toggle the state as there's no stop endpoint
        setIsMonitoring(false);
        success('Monitoring paused');
      }
    } catch (err) {
      error('Failed to toggle monitoring');
      console.error('Error toggling monitoring:', err);
    } finally {
      setIsLoadingMonitoring(false);
    }
  };
  
  const handleClearQueue = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/jobs/clear-queue`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        success(`Cleared ${data.cleared || 0} jobs from queue`);
        setRefreshKey(prev => prev + 1);
        // Refresh stats after clearing
        fetchStats();
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to clear queue');
      }
    } catch (err) {
      error('Failed to clear queue');
      console.error('Error clearing queue:', err);
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
        setStats({
          active: data.active || 0,
          queued: data.queued || 0,
          completed: data.completed || 0,
          failed: data.failed || 0
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Check monitoring status and fetch stats on mount
  useEffect(() => {
    const checkMonitoringStatus = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
        const response = await fetch(`${apiUrl}/api/jobs/monitoring-status`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setIsMonitoring(data.activeMonitoring > 0);
        }
      } catch (err) {
        console.error('Error checking monitoring status:', err);
      }
    };
    checkMonitoringStatus();
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
        
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Statistics Cards */}
          <div className="flex gap-2">
            <div className="bg-white border border-zinc-200 rounded-md py-1.5 px-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600">Active</span>
                <span className="text-base font-bold text-indigo-600">{stats.active}</span>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-md py-1.5 px-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600">Queued</span>
                <span className="text-base font-bold text-zinc-600">{stats.queued}</span>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-md py-1.5 px-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600">Completed</span>
                <span className="text-base font-bold text-green-600">{stats.completed}</span>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-md py-1.5 px-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-600">Failed</span>
                <span className="text-base font-bold text-red-600">{stats.failed}</span>
              </div>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="monitoring-toggle" className="text-sm font-medium text-zinc-700">
                Monitoring
              </label>
              <Switch
                id="monitoring-toggle"
                checked={isMonitoring}
                onCheckedChange={handleMonitoringToggle}
                disabled={isLoadingMonitoring}
              />
            </div>
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              className="hover:bg-zinc-50"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={handleTestJob}
              className="bg-indigo-600 hover:bg-indigo-700"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Test Job
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline"
                  className="hover:bg-red-50 border-red-200 text-red-600 hover:text-red-700"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Queue
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Jobs</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to clear all jobs? This will remove all queued, completed, failed, and cancelled jobs from the history. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearQueue} className="bg-red-600 hover:bg-red-700">
                    Clear All Jobs
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
      
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>About Background Jobs</CardTitle>
          <CardDescription>Understanding the job processing system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-zinc-600">
          <div>
            <h4 className="font-semibold text-zinc-900 mb-1">Job Types</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Tone Profile Builder</strong> - Analyzes email history to build writing style profiles</li>
              <li><strong>Process New Email</strong> - Processes individual emails for draft generation</li>
              <li><strong>Monitor Inbox</strong> - Checks for new emails in monitored accounts</li>
              <li><strong>Learn From Edit</strong> - Learns from user edits to improve future drafts</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-zinc-900 mb-1">Job Priorities</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Critical</strong> - Processed immediately</li>
              <li><strong>High</strong> - Processed before normal jobs</li>
              <li><strong>Normal</strong> - Standard processing priority</li>
              <li><strong>Low</strong> - Processed when system is idle</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-zinc-900 mb-1">Job Statuses</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Queued</strong> - Waiting to be processed</li>
              <li><strong>Active</strong> - Currently being processed</li>
              <li><strong>Completed</strong> - Successfully finished</li>
              <li><strong>Failed</strong> - Encountered an error</li>
              <li><strong>Cancelled</strong> - Manually cancelled by user</li>
            </ul>
          </div>
          
          <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
            <p className="text-sm text-indigo-700">
              <strong>Real-time Updates:</strong> This page uses WebSocket connections to show live job progress. 
              You&apos;ll see jobs update automatically as they move through the processing pipeline.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}