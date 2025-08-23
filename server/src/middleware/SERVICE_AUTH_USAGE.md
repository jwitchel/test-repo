# Service Token Authentication Usage Guide

## Overview
The service token authentication system allows background workers and scheduled jobs to call protected API endpoints without a user session.

## Configuration
Add to your `.env` file:
```env
SERVICE_TOKEN=your-secure-token-here
```

Generate a secure token:
```bash
openssl rand -base64 32
```

## Usage in API Endpoints

### 1. Support Both User Auth and Service Token
Use `requireAuthOrServiceToken` middleware when an endpoint should work for both logged-in users and background workers:

```typescript
import { requireAuthOrServiceToken } from '../middleware/service-auth';

router.post('/api/some-endpoint', requireAuthOrServiceToken, async (req, res) => {
  const userId = req.user.id;
  const isServiceCall = req.isServiceToken; // true if called with service token
  
  // Your endpoint logic here
});
```

### 2. Service Token Only (Internal APIs)
Use `requireServiceToken` for internal-only endpoints:

```typescript
import { requireServiceToken } from '../middleware/service-auth';

router.post('/api/internal/cleanup', requireServiceToken, async (req, res) => {
  const userId = req.body.userId; // Required in body
  // Internal operation logic
});
```

## Usage in Workers

### Using the Helper Function
The `makeServiceRequest` helper simplifies API calls from workers:

```typescript
import { makeServiceRequest } from '../../middleware/service-auth';

async function myWorkerJob(job: Job) {
  const { userId, someData } = job.data;
  
  try {
    const result = await makeServiceRequest(
      'http://localhost:3002/api/some-endpoint',
      'POST',
      { someData, otherParam: 'value' },
      userId  // Will be added to body automatically
    );
    
    return result;
  } catch (error) {
    console.error('Worker failed:', error);
    throw error;
  }
}
```

### Manual Implementation
If you need more control:

```typescript
const response = await fetch('http://localhost:3002/api/some-endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.SERVICE_TOKEN}`
  },
  body: JSON.stringify({
    userId,  // REQUIRED when using service token
    // ... other data
  })
});
```

## Examples of Endpoints That Could Use Service Auth

### Email Processing
```typescript
// Process inbox periodically
router.post('/api/email/process-inbox', requireAuthOrServiceToken, async (req, res) => {
  const userId = req.user.id;
  // Process user's inbox
});
```

### Tone Learning
```typescript
// Learn from user edits
router.post('/api/tone/learn-from-edit', requireAuthOrServiceToken, async (req, res) => {
  const userId = req.user.id;
  const { draftId, finalContent } = req.body;
  // Update tone profile based on edits
});
```

### Cleanup Jobs
```typescript
// Clean old data (internal only)
router.delete('/api/internal/cleanup-old-data', requireServiceToken, async (req, res) => {
  const { userId, daysOld } = req.body;
  // Delete old data for user
});
```

## Security Considerations

1. **Keep SERVICE_TOKEN secure** - Never commit it to version control
2. **Always require userId** - Service token calls must specify which user they're acting on behalf of
3. **Use HTTPS in production** - Tokens should only be transmitted over encrypted connections
4. **Rotate tokens periodically** - Change the SERVICE_TOKEN regularly
5. **Log service token usage** - Monitor for unusual patterns

## Testing

Test service token auth:
```bash
# Test with curl
curl -X POST http://localhost:3002/api/training/analyze-patterns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-service-token" \
  -d '{"userId": "test-user-id", "force": true}'
```

Test from Node.js:
```typescript
import { makeServiceRequest } from './middleware/service-auth';

const result = await makeServiceRequest(
  'http://localhost:3002/api/training/analyze-patterns',
  'POST',
  { force: true },
  'test-user-id'
);
```