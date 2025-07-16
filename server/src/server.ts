import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth';
import { createServer } from 'http';
import { createImapLogsWebSocketServer } from './websocket/imap-logs';

// Load environment variables
dotenv.config();

// Validate required environment variables
if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY environment variable is required');
  console.error('   Please set ENCRYPTION_KEY in your .env file');
  console.error('   Generate one with: openssl rand -base64 32');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3002;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection and initialize better-auth
async function initializeDatabase() {
  try {
    // Test PostgreSQL connection
    await pool.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Better-auth will auto-create its tables on first use
    // Try to initialize by making a test call
    console.log('🔄 Initializing better-auth tables...');
    
    return true;
  } catch (err) {
    console.error('❌ Database initialization error:', err);
    return false;
  }
}

// Initialize database on startup
initializeDatabase();

// CORS configuration for Next.js frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true, // Enable cookies for sessions
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Better Auth routes - handles /api/auth/signup, /api/auth/signin, etc.
// IMPORTANT: Don't use express.json() before better-auth
app.all('/api/auth/*', toNodeHandler(auth));

// Body parsing middleware (after better-auth)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Protected route middleware
export const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  try {
    // Create a headers object that better-auth expects
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        headers.set(key, Array.isArray(value) ? value[0] : value);
      }
    });

    const session = await auth.api.getSession({
      headers: headers,
    });

    if (!session) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Add user info to request
    (req as any).user = session.user;
    (req as any).session = session;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid session' });
  }
};

// API Routes
import authRoutes from './routes/auth';
import emailAccountRoutes from './routes/email-accounts';
import toneProfileRoutes from './routes/tone-profile';
import mockImapRoutes, { stopAllMockClients } from './routes/mock-imap';

app.use('/api/custom-auth', authRoutes);
app.use('/api/email-accounts', emailAccountRoutes);
app.use('/api/tone-profile', toneProfileRoutes);
app.use('/api/mock-imap', mockImapRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server for IMAP logs
const wsServer = createImapLogsWebSocketServer(server);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully');
  
  // Stop all mock IMAP clients
  stopAllMockClients();
  
  // Close WebSocket server first
  await wsServer.close();
  
  // Close database pool
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully');
  
  // Stop all mock IMAP clients
  stopAllMockClients();
  
  // Close WebSocket server first
  await wsServer.close();
  
  // Close database pool
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth/*`);
  console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws/imap-logs`);
  console.log(`🎭 Mock IMAP API: http://localhost:${PORT}/api/mock-imap/*`);
});

export { app, pool, auth, server, wsServer };