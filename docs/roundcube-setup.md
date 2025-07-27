# Roundcube Webmail Setup Guide

This guide will help you set up Roundcube as a webmail interface to view emails in your test mail server.

## Prerequisites

- Docker and Docker Compose installed
- Test mail server running (`npm run mail:up`)
- Test email accounts created (`npm run mail:seed`)

## Quick Start

1. **Start Roundcube**
   ```bash
   docker-compose -f docker-compose.roundcube.yml up -d
   ```

2. **Access Roundcube**
   - Open your browser to: http://localhost:8888
   - Login with test credentials:
     - Username: `user1` (without @testmail.local - it will be added automatically)
     - Password: `testpass123`
   
   Alternative login formats that work:
   - Username: `user1@testmail.local` (full email)
   - Username: `user1` (domain will be auto-appended)

## Available Test Accounts

After running `npm run mail:seed`, these accounts are available:
- `user1@testmail.local` (password: `testpass123`)
- `user2@testmail.local` (password: `testpass123`)
- `user3@testmail.local` (password: `testpass123`)

## Loading Johns Emails

To populate the test mail server with sample emails:

```bash
# Load 1000 test emails from Johns dataset
npm run mail:load-johns
```

After loading, you can view these emails in Roundcube by logging in as `user1@testmail.local`.

## Troubleshooting

### Cannot connect to mail server
If Roundcube cannot connect to the test mail server:

1. Ensure the test mail server is running:
   ```bash
   docker ps | grep test-mailserver
   ```

2. If not running, start it:
   ```bash
   npm run mail:up
   ```

### Password encryption issues
If you encounter "Failed to decrypt password" errors when using the Training Panel:

```bash
# Fix encryption for test accounts
npm run mail:fix-encryption-simple
```

### View Roundcube logs
```bash
docker logs roundcube
```

### Stop Roundcube
```bash
docker-compose -f docker-compose.roundcube.yml down
```

### Reset everything
To completely reset your test environment:

```bash
# Stop all services
docker-compose -f docker-compose.roundcube.yml down
npm run docker:down

# Start fresh
npm run docker:up
npm run mail:seed
npm run mail:load-johns
docker-compose -f docker-compose.roundcube.yml up -d
```

## Troubleshooting Login Issues

If you get "email/username not valid" error:
1. Try using just the username without domain: `user1` instead of `user1@testmail.local`
2. The domain `@testmail.local` will be automatically appended
3. Make sure the test mail server is running: `docker ps | grep test-mailserver`
4. Verify accounts exist: `docker exec test-mailserver setup email list`

## Using with Training Panel

1. Fix encryption if needed: `npm run mail:fix-encryption-simple`
2. Load Johns emails: `npm run mail:load-johns`
3. Access the Training Panel at: http://localhost:3001/inspector
4. Click "Load Emails" to import sent emails into the vector database
5. Monitor progress in the Training Panel
6. View emails in Roundcube to verify what's being processed

## Architecture Notes

- Roundcube runs in Docker and connects to your test mail server on port 1143
- Uses SQLite for its own database (persisted in `./roundcube/db`)
- Configured to auto-append `@testmail.local` domain if not provided in username
- Uses the Elastic skin for a modern interface