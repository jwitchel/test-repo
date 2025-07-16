# WebSocket IMAP Logs

This WebSocket server provides real-time streaming of IMAP operation logs to authenticated users.

## Endpoint

`ws://localhost:3002/ws/imap-logs`

## Authentication

The WebSocket server uses the same better-auth session authentication as the REST API. Clients must have a valid session cookie to connect.

## Client Message Types

### `ping`
Send a ping to check connection health.
```json
{ "type": "ping" }
```
Response: `{ "type": "pong" }`

### `get-logs`
Request historical logs for the authenticated user.
```json
{ 
  "type": "get-logs",
  "limit": 100  // optional, defaults to 100
}
```
Response: `{ "type": "logs", "data": [...] }`

### `clear-logs`
Clear all logs for the authenticated user.
```json
{ "type": "clear-logs" }
```
Response: `{ "type": "logs-cleared" }`

## Server Message Types

### `initial-logs`
Sent immediately after connection with the last 100 logs.
```json
{
  "type": "initial-logs",
  "data": [/* array of ImapLogEntry */]
}
```

### `log`
Real-time log entry as IMAP operations occur.
```json
{
  "type": "log",
  "data": {
    "id": "uuid",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "userId": "user-id",
    "emailAccountId": "email-account-id",
    "level": "info",
    "command": "FETCH",
    "data": {
      "raw": "...",
      "parsed": {},
      "response": "...",
      "duration": 150,
      "error": null
    }
  }
}
```

### `logs-cleared`
Notification that logs have been cleared.
```json
{ "type": "logs-cleared" }
```

### `error`
Error message for invalid requests.
```json
{
  "type": "error",
  "error": "Error message"
}
```

## Implementation Details

- Uses the `ws` package for WebSocket support
- Integrates with Express HTTP server
- Authenticates using better-auth sessions
- Maintains per-user connection pools
- Implements ping/pong for connection health monitoring
- Sanitizes log data to remove sensitive information
- Gracefully handles server shutdown

## Usage Example

```typescript
const ws = new WebSocket('ws://localhost:3002/ws/imap-logs', {
  headers: {
    cookie: document.cookie // Pass session cookie
  }
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  if (message.type === 'log') {
    console.log('New IMAP log:', message.data);
  }
});
```