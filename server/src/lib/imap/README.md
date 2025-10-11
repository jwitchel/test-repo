# IMAP Implementation Documentation

## Overview

The IMAP implementation provides a robust, production-ready interface for connecting to email servers. It includes connection pooling, automatic retry logic, comprehensive error handling, and real-time logging of all IMAP operations.

## Architecture

### Core Components

1. **ImapConnection** (`imap-connection.ts`)
   - Low-level IMAP client wrapper
   - Handles connection lifecycle
   - Logs all operations via RealTimeLogger
   - Emits events for real-time monitoring

2. **ImapConnectionPool** (`imap-pool.ts`)
   - Manages connection pooling
   - Automatic connection reuse
   - Idle connection cleanup
   - Configurable pool limits

3. **ImapOperations** (`imap-operations.ts`)
   - High-level API for email operations
   - Automatic connection management
   - Database integration
   - Simplified error handling

## Features

### Connection Pooling
- Reuses existing connections for better performance
- Configurable min/max connections per account
- Automatic cleanup of idle connections
- Connection health monitoring

### Error Handling
- Automatic retry with exponential backoff
- Specific error types for different failures
- Graceful degradation
- Detailed error logging

### Real-time Logging
- All IMAP operations logged via WebSocket
- Sensitive data sanitization
- Command/response tracking
- Performance metrics

### Security
- Encrypted password storage
- TLS/SSL support
- Session-scoped connections
- No credential logging

## API Endpoints

### Email Account Management
- `POST /api/email-accounts` - Add new email account with IMAP validation
- `GET /api/email-accounts` - List user's email accounts
- `DELETE /api/email-accounts/:id` - Remove email account

### IMAP Operations
- `GET /api/imap/accounts/:id/folders` - List folders
- `GET /api/imap/accounts/:id/folders/:folder/messages` - List messages
- `POST /api/imap/accounts/:id/folders/:folder/search` - Search messages
- `GET /api/imap/accounts/:id/folders/:folder/messages/:uid` - Get single message
- `PUT /api/imap/accounts/:id/folders/:folder/messages/:uid/read` - Mark as read
- `PUT /api/imap/accounts/:id/folders/:folder/messages/:uid/unread` - Mark as unread
- `DELETE /api/imap/accounts/:id/folders/:folder/messages/:uid` - Delete message

## Configuration

### Environment Variables
```env
# IMAP Pool Configuration
IMAP_POOL_MAX_CONNECTIONS=5      # Max connections per account
IMAP_POOL_MIN_CONNECTIONS=1      # Min connections to maintain
IMAP_POOL_IDLE_TIMEOUT=300000    # 5 minutes idle timeout
IMAP_POOL_RETRY_ATTEMPTS=3       # Connection retry attempts
IMAP_POOL_RETRY_DELAY=1000       # Initial retry delay (ms)

# IMAP Logging
IMAP_LOG_LEVEL=info              # Log level (debug|info|warn|error)
IMAP_MAX_LOGS_PER_USER=1000      # Max logs to keep per user
```

### Connection Configuration
```typescript
const config: ImapConfig = {
  user: 'user@example.com',
  password: 'password',
  host: 'imap.example.com',
  port: 993,
  tls: true,
  tlsOptions: {
    rejectUnauthorized: false  // For self-signed certificates
  },
  authTimeout: 10000,
  connTimeout: 10000,
  keepalive: {
    interval: 10000,
    idleInterval: 300000,
    forceNoop: true
  }
};
```

## Usage Examples

### Basic Usage
```typescript
// Get IMAP operations instance
const imapOps = await ImapOperations.fromAccountId(accountId, userId);

try {
  // Test connection
  const connected = await imapOps.testConnection();
  
  // Get folders
  const folders = await imapOps.getFolders();
  
  // Get messages
  const messages = await imapOps.getMessages('INBOX', {
    limit: 50,
    offset: 0,
    descending: true
  });
  
  // Search messages
  const unread = await imapOps.searchMessages('INBOX', {
    unseen: true,
    since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  });
  
} finally {
  // Always release connection back to pool
  imapOps.release();
}
```

### Real-time Monitoring
```typescript
// Start IDLE monitoring for new emails
await imapOps.startIdleMonitoring('INBOX', (event) => {
  if (event.type === 'new_mail') {
    console.log(`${event.count} new emails received`);
  }
});

// Stop monitoring
imapOps.stopIdleMonitoring();
```

## Testing

### Docker Test Email Server
The project includes a Docker-based test email server for development:

```bash
# Start test email server
npm run test:mail:start

# Create test accounts
npm run test:mail:setup

# Run IMAP tests
npm test -- imap-connection.test.ts
```

Test accounts:
- user1@testmail.local / testpass123
- user2@testmail.local / testpass123
- user3@testmail.local / testpass123

### Common Email Providers

The implementation has been tested with:
- Gmail (imap.gmail.com:993)
- Outlook (outlook.office365.com:993)
- Yahoo (imap.mail.yahoo.com:993)
- Custom servers (Dovecot, Cyrus, etc.)

## Troubleshooting

### Connection Issues
1. Check firewall settings for IMAP ports (143, 993)
2. Verify SSL/TLS settings match server requirements
3. For Gmail, enable "Less secure app access" or use App Passwords
4. Check server logs in real-time via WebSocket viewer

### Authentication Failures
1. Verify username format (full email vs username only)
2. Check for special characters in passwords
3. Ensure account has IMAP enabled
4. Try connection with email client first

### Performance Issues
1. Increase connection pool size for high volume
2. Enable debug logging to identify slow operations
3. Use pagination for large folders
4. Consider implementing local caching

## Future Enhancements

1. **OAuth2 Support** - For Gmail and Outlook
2. **Push Notifications** - Using IMAP IDLE more efficiently
3. **Attachment Handling** - Stream large attachments
4. **Full-text Search** - Local index for faster searching
5. **Folder Synchronization** - Efficient delta sync
6. **Rate Limiting** - Prevent server overload
7. **Connection Metrics** - Prometheus/Grafana integration