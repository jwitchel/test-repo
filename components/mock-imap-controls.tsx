"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlayCircle, StopCircle, Zap, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MockImapControlsProps {
  emailAccountId: string;
}

const TEST_SEQUENCES = {
  basic: 'Basic Connection',
  fullSync: 'Full Sync',
  errors: 'Error Scenarios',
  monitoring: 'Monitoring Mode'
};

const SCENARIOS = {
  'new-email': 'New Email Notification',
  'connection-loss': 'Connection Loss',
  'sync-folder': 'Sync Folder'
};

export function MockImapControls({ emailAccountId }: MockImapControlsProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [folderName, setFolderName] = useState('INBOX');
  const [messageCount, setMessageCount] = useState(10);
  const { success, error: showError } = useToast();

  // Check if mock operations are running on mount
  useEffect(() => {
    checkStatus();
  }, [emailAccountId]);

  const checkStatus = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/mock-imap/status', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const isActive = data.mockClients.some((client: any) => 
          client.emailAccountId === emailAccountId
        );
        setIsRunning(isActive);
      }
    } catch (err) {
      console.error('Failed to check status:', err);
    }
  };

  const startOperations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3002/api/mock-imap/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          emailAccountId,
          interval: 2000 
        })
      });

      if (response.ok) {
        setIsRunning(true);
        success('Mock IMAP operations started');
      } else {
        const data = await response.json();
        showError(data.error || 'Failed to start operations');
      }
    } catch (err) {
      showError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const stopOperations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3002/api/mock-imap/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ emailAccountId })
      });

      if (response.ok) {
        setIsRunning(false);
        success('Mock IMAP operations stopped');
      } else {
        const data = await response.json();
        showError(data.error || 'Failed to stop operations');
      }
    } catch (err) {
      showError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const runSequence = async (sequence: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3002/api/mock-imap/sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          emailAccountId,
          sequence 
        })
      });

      if (response.ok) {
        const data = await response.json();
        success(`Completed ${sequence} sequence`);
      } else {
        const data = await response.json();
        showError(data.error || 'Failed to run sequence');
      }
    } catch (err) {
      showError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const runScenario = async (scenario: string) => {
    setIsLoading(true);
    try {
      const body: any = { 
        emailAccountId,
        scenario 
      };

      if (scenario === 'sync-folder') {
        body.folderName = folderName;
        body.messageCount = messageCount;
      }

      const response = await fetch('http://localhost:3002/api/mock-imap/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const data = await response.json();
        success(data.message);
      } else {
        const data = await response.json();
        showError(data.error || 'Failed to run scenario');
      }
    } catch (err) {
      showError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mock IMAP Operations</CardTitle>
        <CardDescription>
          Test the IMAP logging system with simulated operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Continuous Operations */}
        <div className="space-y-2">
          <Label>Continuous Operations</Label>
          <div className="flex gap-2">
            {!isRunning ? (
              <Button 
                onClick={startOperations} 
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                Start Continuous
              </Button>
            ) : (
              <Button 
                onClick={stopOperations} 
                disabled={isLoading}
                variant="destructive"
                className="flex-1"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <StopCircle className="mr-2 h-4 w-4" />
                )}
                Stop Operations
              </Button>
            )}
          </div>
          {isRunning && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Operations running every 2 seconds
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Test Sequences */}
        <div className="space-y-2">
          <Label>Test Sequences</Label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(TEST_SEQUENCES).map(([key, label]) => (
              <Button
                key={key}
                variant="outline"
                onClick={() => runSequence(key)}
                disabled={isLoading}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Scenarios */}
        <div className="space-y-2">
          <Label>Scenarios</Label>
          <div className="space-y-2">
            {Object.entries(SCENARIOS).map(([key, label]) => (
              <div key={key}>
                {key === 'sync-folder' && (
                  <div className="flex gap-2 mb-2">
                    <Input
                      placeholder="Folder name"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Messages"
                      value={messageCount}
                      onChange={(e) => setMessageCount(parseInt(e.target.value) || 0)}
                      className="w-24"
                    />
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => runScenario(key)}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  {label}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}