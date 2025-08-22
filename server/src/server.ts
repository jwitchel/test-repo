import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './lib/auth';
import { createServer } from 'http';
import { createUnifiedWebSocketServer } from './websocket/unified-websocket';

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

// Import and re-export auth middleware
import { requireAuth } from './middleware/auth';
export { requireAuth };

// API Routes
import authRoutes from './routes/auth';
import emailAccountRoutes from './routes/email-accounts';
import toneProfileRoutes from './routes/tone-profile';
import imapRoutes from './routes/imap';
import relationshipsRoutes from './routes/relationships';
import styleRoutes from './routes/style';
import analyzeRoutes from './routes/analyze';
import llmProvidersRoutes from './routes/llm-providers';
import generateRoutes from './routes/generate';
import trainingRoutes from './routes/training';
import oauthEmailRoutes from './routes/oauth-email';
import oauthDirectRoutes from './routes/oauth-direct';
import accountsRoutes from './routes/accounts';
import signaturePatternsRoutes from './routes/signature-patterns';
import settingsRoutes from './routes/settings';
import imapDraftRoutes from './routes/imap-draft';
import inboxRoutes from './routes/inbox';
import inboxDraftRoutes from './routes/inbox-draft';
import monitoringRoutes from './routes/monitoring';
import queueRoutes from './routes/queue';
import imapMonitorRoutes from './routes/imap-monitor';
import jobsRoutes from './routes/jobs';

app.use('/api/custom-auth', authRoutes);
app.use('/api/email-accounts', emailAccountRoutes);
app.use('/api/tone-profile', toneProfileRoutes);
app.use('/api/imap', imapRoutes);
app.use('/api/relationships', relationshipsRoutes);
app.use('/', styleRoutes);
app.use('/', analyzeRoutes);
app.use('/api/llm-providers', llmProvidersRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/training', trainingRoutes);
app.use('/api/oauth-email', oauthEmailRoutes);
app.use('/api/oauth-direct', oauthDirectRoutes);
app.use('/api', accountsRoutes);
app.use('/api/signature-patterns', signaturePatternsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/imap-draft', imapDraftRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/inbox-draft', inboxDraftRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/imap-monitor', imapMonitorRoutes);
app.use('/api/jobs', jobsRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

// Create HTTP server
const server = createServer(app);

// Create unified WebSocket server
const wsServer = createUnifiedWebSocketServer(server);

// Import IMAP pool for cleanup
import { imapPool } from './lib/imap-pool';

// Initialize queue event listeners (for WebSocket broadcasting)
import './lib/queue-events';


// Catch uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});



// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully');
  
  // Stop all mock IMAP clients
  
  // Close IMAP connection pool
  await imapPool.closeAll();
  console.log('IMAP connection pool closed');
  
  // Close WebSocket server
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
  
  // Close IMAP connection pool
  await imapPool.closeAll();
  console.log('IMAP connection pool closed');
  
  // Close WebSocket server
  await wsServer.close();
  
  // Close database pool
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

// Start server only if not in script mode
if (process.env.SKIP_SERVER_START !== 'true') {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth/*`);
    console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws/imap-logs`);
    console.log(`📧 IMAP API: http://localhost:${PORT}/api/imap/*`);
    console.log(`🤖 LLM Providers API: http://localhost:${PORT}/api/llm-providers/*`);
    console.log(`✨ Generate API: http://localhost:${PORT}/api/generate/*`);
    console.log(`🎯 Training API: http://localhost:${PORT}/api/training/*`);
  });
}

// Handle server errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please try one of these solutions:`);
    console.error(`   1. Kill the process: lsof -ti:${PORT} | xargs kill -9`);
    console.error(`   2. Or wait a moment and try again`);
    console.error(`   3. Or use a different port by setting PORT env variable`);
    process.exit(1);
  } else {
    console.error('Server error:', error);
    process.exit(1);
  }
});

export { app, pool, auth, server, wsServer };