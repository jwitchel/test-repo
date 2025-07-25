import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { auth } from '../lib/auth';
import { imapLogger, ImapLogEntry } from '../lib/imap-logger';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  sessionId?: string;
  isAlive?: boolean;
}

export class ImapLogsWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private heartbeatInterval!: NodeJS.Timeout;

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/imap-logs',
      verifyClient: async (info, callback) => {
        try {
          // Create headers object for better-auth
          const headers = new Headers();
          Object.entries(info.req.headers).forEach(([key, value]) => {
            if (value) {
              headers.set(key, Array.isArray(value) ? value[0] : value);
            }
          });

          // Verify session with better-auth
          const session = await auth.api.getSession({ headers });
          
          if (!session) {
            callback(false, 401, 'Unauthorized');
            return;
          }

          // Store session info for later use
          (info.req as any).userId = session.user.id;
          (info.req as any).sessionId = session.session.id;
          
          callback(true);
        } catch (error) {
          console.error('WebSocket authentication error:', error);
          callback(false, 401, 'Unauthorized');
        }
      }
    });

    this.setupEventHandlers();
    this.setupHeartbeat();
    this.setupImapLoggerListeners();
  }

  private setupEventHandlers(): void {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
      const userId = (request as any).userId;
      const sessionId = (request as any).sessionId;

      if (!userId) {
        ws.close(1008, 'User ID not found');
        return;
      }

      // Set up the authenticated websocket
      ws.userId = userId;
      ws.sessionId = sessionId;
      ws.isAlive = true;

      // Add to clients map
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId)!.add(ws);

      console.log(`WebSocket client connected for user ${userId}`);

      // Send initial logs (last 100)
      this.sendInitialLogs(ws, userId);

      // Set up ping/pong handlers
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle messages from client
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message format'
          }));
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
        this.handleDisconnection(ws);
      });
    });
  }

  private setupHeartbeat(): void {
    // Ping clients every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    // Clean up on server shutdown
    this.wss.on('close', () => {
      clearInterval(this.heartbeatInterval);
    });
  }

  private setupImapLoggerListeners(): void {
    // Listen for all log events
    imapLogger.on('log', (logEntry: ImapLogEntry) => {
      this.broadcastToUser(logEntry.userId, {
        type: 'new-log',  // Changed from 'log' to 'new-log' to match client
        log: logEntry     // Changed from 'data' to 'log' to match client
      });
    });

    // Listen for logs cleared events
    imapLogger.on('logs-cleared', ({ userId }: { userId: string }) => {
      this.broadcastToUser(userId, {
        type: 'logs-cleared'
      });
    });
  }

  private sendInitialLogs(ws: AuthenticatedWebSocket, userId: string): void {
    try {
      const logs = imapLogger.getLogs(userId, 100);
      ws.send(JSON.stringify({
        type: 'initial-logs',
        logs: logs  // Changed from 'data' to 'logs' to match client expectation
      }));
    } catch (error) {
      console.error('Error sending initial logs:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to load initial logs'
      }));
    }
  }

  private handleClientMessage(ws: AuthenticatedWebSocket, message: any): void {
    const { type, ...payload } = message;

    switch (type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'clear-logs':
        if (ws.userId) {
          imapLogger.clearLogs(ws.userId);
        }
        break;

      case 'get-logs':
        if (ws.userId) {
          const limit = payload.limit || 100;
          const logs = imapLogger.getLogs(ws.userId, limit);
          ws.send(JSON.stringify({
            type: 'logs',
            data: logs
          }));
        }
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: `Unknown message type: ${type}`
        }));
    }
  }

  private handleDisconnection(ws: AuthenticatedWebSocket): void {
    if (ws.userId) {
      const userClients = this.clients.get(ws.userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          this.clients.delete(ws.userId);
        }
      }
      console.log(`WebSocket client disconnected for user ${ws.userId}`);
    }
  }

  private broadcastToUser(userId: string, message: any): void {
    const userClients = this.clients.get(userId);
    if (!userClients) return;

    const messageStr = JSON.stringify(message);
    userClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  /**
   * Gracefully shutdown the WebSocket server
   */
  public close(): Promise<void> {
    return new Promise((resolve) => {
      clearInterval(this.heartbeatInterval);
      
      // Close all client connections
      this.wss.clients.forEach((client) => {
        client.close(1001, 'Server shutting down');
      });

      this.wss.close(() => {
        console.log('WebSocket server closed');
        resolve();
      });
    });
  }
}

/**
 * Create and attach WebSocket server to HTTP server
 */
export function createImapLogsWebSocketServer(server: HTTPServer): ImapLogsWebSocketServer {
  return new ImapLogsWebSocketServer(server);
}