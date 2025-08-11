# AI Email Assistant Project - Claude Instructions

## Project Overview
This is an AI Email Assistant application that generates email reply drafts matching the user's personal writing tone. The project is managed through GitHub Issues and Projects.

## Current Project State (End of Sprint 1)

### ✅ What's Working
- **Authentication System**: Full auth flow with better-auth
  - Sign up, sign in, sign out functionality
  - Protected routes with automatic redirects
  - Session persistence with httpOnly cookies
  - Cross-origin auth between Next.js (3001) and Express (3002)
- **Frontend**: Next.js with TypeScript on port 3001
- **Backend**: Express.js API on port 3002
- **Database**: PostgreSQL on port 5434 (Docker)
- **Cache**: Redis on port 6380 (Docker)
- **UI Components**: shadcn/ui with Zinc/Indigo theme

### 🚀 Quick Development Start
```bash
# Start Docker services
docker compose up -d

# Start both frontend and backend
npm run dev:all

# Seed demo data (creates users, styles, emails, etc.)
npm run seed
```

Test users available:
- test1@example.com / password123
- test2@example.com / password456

## GitHub CLI Reference

**IMPORTANT**: The `gh project list` command does NOT accept --repo flag. Only use --owner flag.

### Finding Projects and Issues
```bash
# List all projects for an owner (CORRECT)
gh project list --owner jwitchel

# View project details (replace PROJECT_NUMBER with actual number)
gh project view PROJECT_NUMBER --owner jwitchel

# List all issues in the repository
gh issue list --repo jwitchel/test-repo --limit 100

# View specific issue details
gh issue view ISSUE_NUMBER --repo jwitchel/test-repo

# Search for specific tasks
gh issue list --repo jwitchel/test-repo --search "Sprint 1"

# List all issues with specific label
gh issue list --repo jwitchel/test-repo --label "Sprint 3"

# Export issues to JSON
gh issue list --repo jwitchel/test-repo --json number,title,body,labels --limit 100 > issues.json
```

### Managing Tasks
```bash
# Create a new issue and add to project
gh issue create --repo jwitchel/test-repo --title "Task Title" --body "Task description" --project PROJECT_NUMBER

# Edit issue body/description (preferred method for updating subtasks)
gh issue edit ISSUE_NUMBER --repo jwitchel/test-repo --body "New content here"

# Add comments ONLY when explicitly requested by user
gh issue comment ISSUE_NUMBER --repo jwitchel/test-repo --body "Progress update..."
```

### Project Management
```bash
# List project fields (to get field IDs)
gh project field-list PROJECT_NUMBER --owner jwitchel

# List items in project
gh project item-list PROJECT_NUMBER --owner jwitchel --limit 100

# Move task to "In Progress"
gh project item-edit --owner jwitchel --id ITEM_ID --field-id STATUS_FIELD_ID --project-id PROJECT_ID --text "In Progress"

# Mark task as completed
gh project item-edit --owner jwitchel --id ITEM_ID --field-id STATUS_FIELD_ID --project-id PROJECT_ID --text "Done"

# Archive completed items
gh project item-archive PROJECT_NUMBER --owner jwitchel --id ITEM_ID
```

## Project Structure

### Sprints and Milestones
The project is organized into 7 sprints indicated by the first number in the Task name (e.g. 1.3 is Sprint 1 Task 3).  Issue # is not an indicator of what sprint it's in:
- **Sprint 1**: Foundation Setup ✅ COMPLETED
- **Sprint 2**: Email Integration
- **Sprint 3**: Tone Analysis Engine
- **Sprint 4**: Draft Generation 
- **Sprint 5**: Testing & Error Handling
- **Sprint 6**: Polish & Optimization 
- **Sprint 7**: Production Readiness

## Important Configuration Notes
- **Docker Ports** (non-standard to avoid conflicts):
  - PostgreSQL: 5434 (instead of 5432)
  - Redis: 6380 (instead of 6379)
- **Application Ports**:
  - Next.js frontend: 3001 (instead of 3000)
  - Express backend: 3002
- Project structure: Next.js app at repository root (not in subdirectory)
- Express server in `/server` directory

## Working with Subtasks

**IMPORTANT**: Subtasks are the individual checkboxes (- [ ]) in the issue description. They should be performed ONE AT A TIME unless otherwise instructed by the user. Complete each subtask fully before moving to the next one.

**IMPORTANT**: NEVER add comments to issues unless specifically instructed by the user. Always update subtask checkboxes directly in the main issue body using `gh issue edit`.

## Key Architecture Decisions

### Technology Stack
- **Frontend**: Next.js with shadcn/ui components
- **Backend**: Express.js API with better-auth
- **WebSocket**: Real-time updates
- **Database**: PostgreSQL (Docker)
- **Queue**: BullMQ with Redis (Docker)
- **Email**: IMAP integration with node-imap (Docker)

### Development Setup
- Docker runs PostgreSQL, Redis, and the test mail server (node-imap) only
- Next.js and Express run locally (not in Docker) 
- Authentication is centralized in Express API
- Frontend and backend communicate via CORS-enabled API

### Important Architecture Notes
1. **Authentication**: 
   - All auth handled by Express API using better-auth
   - Uses scrypt password hashing (from @noble/hashes)
   - Session table requires: id, userId, expiresAt, token, createdAt, updatedAt, ipAddress, userAgent
   - httpOnly cookies for security (no JWT)
2. **Database**: 
   - PostgreSQL with better-auth tables (user, account, session)
   - Account table stores hashed passwords
   - User table stores profile information
3. **API Communication**:
   - Frontend uses better-auth client library
   - Automatic cookie handling for sessions
   - CORS configured for localhost:3001 ↔ localhost:3002
4. **Real-time Logging**: WebSocket connections for debugging IMAP, parsing, tone analysis
5. **Relationship System**: Category-based (not individual-based) with user-defined mappings
6. **UI Components**: Always use shadcn/ui for consistency
7. **IMAP Implementation**: 
   - Production-ready IMAP client with connection pooling
   - Real-time operation logging via WebSocket
   - Support for all major email providers
   - Comprehensive error handling and retry logic

## UI Components (shadcn/ui)

The project uses shadcn/ui with Tailwind CSS v4, Zinc base colors for neutral elements, and Indigo accent colors for primary actions. Components are initialized with oklch color values for better color accuracy.

### Available Components
- Button, Card, Input, Label, Alert (with success/info variants)
- Accordion, Badge, Skeleton, Dialog, Form
- Sonner (for toast notifications - replaces deprecated toast/toaster)

### Toast Notifications
Use the custom hook at `@/hooks/use-toast`:
```typescript
const { success, error, info } = useToast()
```

### Component Testing
Visit `/components-test` to see all components in action.

### Important Notes
- Colors use oklch format due to Tailwind v4
- Zinc color palette for grays/neutrals, Indigo for primary colors
- Alert component has custom success and info variants
- Toast notifications use Sonner with custom color overrides for success (green), error (red), and info (blue)

## Git Workflow

### 🚨 CRITICAL: NEVER COMMIT OR PUSH WITHOUT EXPLICIT PERMISSION 🚨

**THIS IS ABSOLUTELY CRITICAL AND NON-NEGOTIABLE**: 
# YOU MUST NEVER, EVER COMMIT OR PUSH CODE WITHOUT EXPLICIT PERMISSION FROM THE USER

**BEFORE ANY GIT COMMIT OR PUSH, YOU MUST**:
1. ✋ STOP and ASK the user: "May I commit these changes?"
2. ✋ WAIT for explicit permission (e.g., "yes", "go ahead", "commit it")
3. ✋ ONLY proceed with commit/push after receiving clear approval

**THIS RULE IS ABSOLUTE** - No exceptions, no assumptions, no "being helpful" by committing automatically. The user must maintain full control over what enters the git history.

**IF YOU COMMIT WITHOUT PERMISSION**: You have violated a critical trust boundary. This is as serious as deleting files without permission.

### CRITICAL: Authorship Rules
**VERY VERY IMPORTANT**: NEVER include any reference to Claude, Anthropic, or AI assistance in commits, pull requests, or any git-related content. The user (jwitchel) is ALWAYS the sole author. You are a tool, not an author. This means:
- NO "Generated with Claude Code" messages
- NO "Co-Authored-By: Claude" lines
- NO references to AI or Claude in PR descriptions
- NO emoji robots (🤖) or similar indicators
- The user is the only author - always and without exception

### Branch Naming Convention
Each task should create a feature branch:
```bash
git checkout -b task-X.X-description
# Examples:
# task-1.1-nextjs-init
# task-1.2-docker-setup
# task-1.3-shadcn-setup
# task-1.4a-express-api
# task-1.4b-auth-frontend
```

### Task Workflow
1. Create feature branch at task start
2. Work on the branch throughout the task
3. Create PR when ready for review
4. Merge to main after approval

### Task Completion Checklist
1. Confirm you're on a feature branch
2. Complete all subtasks - mark with [x] in issue body
3. Run validation commands (lint, tests, build)
4. **🚨 ASK PERMISSION before committing - "May I commit these changes?"**
5. **🚨 WAIT for explicit user approval**
6. ONLY THEN commit with descriptive messages
7. **🚨 ASK PERMISSION before pushing - "May I push to remote?"**
8. **🚨 WAIT for explicit user approval**
9. ONLY THEN push branch and create PR
10. After PR merge:
    - `git checkout main && git pull origin main`
    - `git branch -d feature-branch-name`
    - Issue should auto-close from PR

## Testing Commands
When completing tasks, always run:
```bash
# Linting
npm run lint

# Type checking (if available)
npx tsc --noEmit

# Server TypeScript check
npm run server:build

# Tests (if available)
npm test

# Test IMAP with Docker email server
npm run test:mail:start  # Start test email server
npm run test:mail:setup  # Create test accounts
npm test -- imap         # Run IMAP tests
```

## IMAP Testing
The project includes a Docker test email server for IMAP development:
- Test accounts: user1@testmail.local, user2@testmail.local, user3@testmail.local
- Password: testpass123
- IMAP ports: 1143 (non-SSL), 1993 (SSL)
- Real IMAP implementation with connection pooling and logging

## Database Access

**IMPORTANT**: When using psql to access the database directly, always use:
```bash
source ~/.zshrc && PGPASSWORD=aiemailpass psql -U aiemailuser -h localhost -p 5434 -d aiemaildb
```

The `source ~/.zshrc` is required because psql is installed via Homebrew at `/opt/homebrew/opt/libpq/bin/psql` and needs the PATH to be set up correctly.

Example queries:
```bash
# Check database version
source ~/.zshrc && PGPASSWORD=aiemailpass psql -U aiemailuser -h localhost -p 5434 -d aiemaildb -c "SELECT version();"

# View tone preferences
source ~/.zshrc && PGPASSWORD=aiemailpass psql -U aiemailuser -h localhost -p 5434 -d aiemaildb -c "SELECT target_identifier, jsonb_pretty(profile_data) FROM tone_preferences LIMIT 1;"
```

## Common Issues and Solutions

### Authentication Issues
1. **Password hashing**: better-auth uses scrypt from @noble/hashes, not bcrypt
2. **Session table**: Must have all required columns (see Architecture Notes)
3. **CORS errors**: Ensure trustedOrigins includes both localhost:3001 and localhost:3002

### Database Issues
1. **Connection refused**: Check Docker is running and using port 5434
2. **Missing tables**: better-auth auto-creates tables on first use
3. **Test users**: Use `npm run create-test-users` script

### Development Tips
1. Use `npm run dev:all` to start both servers
2. Check server logs in terminal for debugging
3. Browser DevTools Network tab helps debug auth issues
4. Clear cookies if session problems persist

## Project Files
- **README.md**: User-facing documentation with setup instructions
- **CLAUDE.md**: This file - instructions for Claude
- **complete_project_plan.md**: Original master project specification document
- **.env.example**: Template for environment variables
- **docker-compose.yml**: Docker services configuration
- **/scripts**: Utility scripts for development

## Notes for Future Sessions
- All new tasks should be assigned to the project and given the "Backlog" status initially
- Each task has detailed subtasks, code examples, and acceptance criteria
- **GitHub CLI**: Remember `gh project list` does NOT accept --repo flag, only --owner
- **Subtask Updates**: Always update subtasks in issue body, never use comments unless requested
- **Authentication**: Full system working - use test users for development
- **Validation**: Always run lint before committing
- **🚨 CRITICAL REMINDER**: NEVER commit or push without explicit permission - ALWAYS ASK FIRST!