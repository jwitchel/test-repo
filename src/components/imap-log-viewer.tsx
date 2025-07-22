"use client"

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trash2, PlayCircle, StopCircle, AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImapLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  emailAccountId: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  command: string;
  data: {
    raw?: string;
    parsed?: unknown;
    response?: string;
    duration?: number;
    error?: string;
  };
}

interface ImapLogViewerProps {
  emailAccountId: string;
  className?: string;
}

export function ImapLogViewer({ emailAccountId, className }: ImapLogViewerProps) {
  // TODO: Use emailAccountId to filter logs for specific email account
  console.log('Viewing logs for account:', emailAccountId);
  const [logs, setLogs] = useState<ImapLogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//localhost:3002/ws/imap-logs`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'initial-logs') {
            setLogs(data.logs || []);
          } else if (data.type === 'new-log' && data.log) {
            setLogs(prev => [...(prev || []), data.log]);
          } else if (data.type === 'logs-cleared') {
            setLogs([]);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError(`WebSocket connection error. Make sure you're signed in and the server is running.`);
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        // Handle authentication errors (401)
        if (event.code === 1002 || event.reason === 'Unauthorized') {
          setError('Authentication required. Please sign in first.');
          return;
        }

        // Auto-reconnect after 5 seconds for other errors
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 5000);
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to connect to log server');
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setLogs([]);
  }, []);

  const clearLogs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'clear-logs' }));
    }
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Connect on mount with a small delay to ensure auth is established
  useEffect(() => {
    const timer = setTimeout(() => {
      connect();
    }, 500); // Small delay to ensure authentication is ready
    
    return () => {
      clearTimeout(timer);
      disconnect();
    };
  }, [connect, disconnect]);

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="h-3 w-3" />;
      case 'warn':
        return <AlertCircle className="h-3 w-3" />;
      case 'info':
        return <CheckCircle className="h-3 w-3" />;
      default:
        return <Info className="h-3 w-3" />;
    }
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-500';
      case 'warn':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      default:
        return 'text-zinc-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  return (
    <Card className={cn("flex flex-col h-full overflow-hidden", className)}>
      <div className="flex items-center justify-between p-2 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">IMAP Logs</h3>
          <Badge variant={isConnected ? "default" : "secondary"} className="text-xs py-0">
            {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(autoScroll && "bg-zinc-100")}
          >
            Auto-scroll: {autoScroll ? 'On' : 'Off'}
          </Button>
          {!isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={connect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={disconnect}
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={clearLogs}
            disabled={!isConnected || !logs || logs.length === 0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="m-4 flex-shrink-0">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            {error.includes('connection error') && (
              <div className="mt-2 text-sm">
                <p>Troubleshooting tips:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>Ensure you&apos;re signed in to your account</li>
                  <li>Check that the backend server is running on port 3002</li>
                  <li>Try refreshing the page</li>
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 overflow-y-auto min-h-0" ref={scrollAreaRef}>
        <div className="p-2 space-y-1">
          {!logs || logs.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">
              {isConnected ? 'No logs yet. Start some IMAP operations to see logs.' : 'Connect to view logs.'}
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="font-mono text-xs border rounded p-2"
              >
                {/* Three column layout */}
                <div className="grid grid-cols-12 gap-2 text-[10px]">
                  {/* Column 1: Header info (3 cols) */}
                  <div className="col-span-3 space-y-1">
                    <div className="text-zinc-500">{formatTimestamp(log.timestamp)}</div>
                    <div className={cn("flex items-center gap-1", getLogColor(log.level))}>
                      {getLogIcon(log.level)}
                      {log.level.toUpperCase()}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-4",
                        log.command.startsWith('email.') && "border-purple-500 text-purple-600",
                        log.command.startsWith('nlp.') && "border-blue-500 text-blue-600",
                        log.command.startsWith('relationship.') && "border-green-500 text-green-600",
                        log.command.startsWith('person.') && "border-yellow-500 text-yellow-600",
                        log.command.startsWith('vector.') && "border-orange-500 text-orange-600",
                        log.command.startsWith('style.') && "border-pink-500 text-pink-600",
                        log.command.startsWith('prompt.') && "border-indigo-500 text-indigo-600",
                        log.command === 'pipeline.complete' && "border-emerald-500 text-emerald-600 font-semibold"
                      )}
                    >
                      {log.command}
                    </Badge>
                    {log.data.duration && (
                      <div className="text-zinc-500 text-[10px]">
                        {log.data.duration}ms
                      </div>
                    )}
                  </div>

                  {/* Column 2: Parsed (4 cols) */}
                  <div className="col-span-4">
                    {log.data.parsed !== undefined && log.data.parsed !== null && (
                      <>
                        <span className="text-zinc-500">Parsed:</span>
                        <pre className="bg-zinc-50 dark:bg-zinc-900 p-1 rounded overflow-x-auto mt-0.5 text-[10px]">
                          {JSON.stringify(log.data.parsed, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>

                  {/* Column 3: Raw (5 cols) */}
                  <div className="col-span-5">
                    {log.data.raw && (
                      <>
                        <span className="text-zinc-500">Raw:</span>
                        <pre className="bg-zinc-50 dark:bg-zinc-900 p-1 rounded overflow-x-auto mt-0.5">
                          {log.data.raw}
                        </pre>
                      </>
                    )}
                  </div>
                </div>

                {/* Response on its own row - usually longer */}
                {log.data.response && (
                  <div className="text-[10px] mt-1">
                    <span className="text-zinc-500">Response:</span>
                    <pre className="bg-zinc-50 dark:bg-zinc-900 p-1 rounded overflow-x-auto whitespace-pre-wrap mt-0.5">
                      {log.data.response}
                    </pre>
                  </div>
                )}

                {/* Error on its own row - important to highlight */}
                {log.data.error && (
                  <div className="text-[10px] mt-1">
                    <span className="text-red-500">Error:</span>
                    <pre className="bg-red-50 dark:bg-red-950 p-1 rounded text-red-600 dark:text-red-400 mt-0.5">
                      {log.data.error}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}