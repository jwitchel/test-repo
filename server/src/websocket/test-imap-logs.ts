import WebSocket from 'ws';
import { realTimeLogger } from '../lib/real-time-logger';

/**
 * Test script for WebSocket IMAP logs
 * 
 * Usage:
 * 1. Start the server: npm run server
 * 2. In another terminal: npx ts-node server/src/websocket/test-imap-logs.ts
 */

async function testWebSocketConnection() {
  const ws = new WebSocket('ws://localhost:3002/ws/imap-logs', {
    headers: {
      // You'll need to add a valid session cookie here after signing in
      cookie: 'better-auth.session_token=YOUR_SESSION_TOKEN'
    }
  });

  ws.on('open', () => {
    console.log('✅ Connected to WebSocket server');

    // Request current logs
    ws.send(JSON.stringify({
      type: 'get-logs',
      limit: 10
    }));

    // Send a ping
    ws.send(JSON.stringify({
      type: 'ping'
    }));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Received:', message.type);
    
    if (message.type === 'initial-logs') {
      console.log(`  Initial logs: ${message.data.length} entries`);
    } else if (message.type === 'logs') {
      console.log(`  Logs: ${message.data.length} entries`);
    } else if (message.type === 'log') {
      console.log(`  New log: ${message.data.command} - ${message.data.level}`);
    } else if (message.type === 'pong') {
      console.log('  Pong received!');
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
  });

  // Simulate some IMAP logs after connection
  setTimeout(() => {
    console.log('\n📝 Simulating IMAP logs...');
    
    // This would normally come from actual IMAP operations
    realTimeLogger.log('test-user-id', {
      userId: 'test-user-id',
      emailAccountId: 'test-email-account',
      level: 'info',
      command: 'CONNECT',
      data: {
        raw: 'Connecting to imap.gmail.com:993',
        duration: 150
      }
    });

    realTimeLogger.log('test-user-id', {
      userId: 'test-user-id',
      emailAccountId: 'test-email-account',
      level: 'debug',
      command: 'LOGIN',
      data: {
        raw: 'LOGIN user@example.com ****',
        response: 'OK LOGIN completed'
      }
    });
  }, 2000);

  // Keep the script running
  setTimeout(() => {
    console.log('\n🛑 Closing connection...');
    ws.close();
    process.exit(0);
  }, 5000);
}

// Run the test
testWebSocketConnection().catch(console.error);