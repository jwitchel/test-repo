# AI Email Assistant Project - Claude Instructions

## Project Overview
This is an AI Email Assistant application that generates email reply drafts matching the user's personal writing tone. The project is managed through GitHub Issues and Projects.

## GitHub Project Access

### Finding the Project

**IMPORTANT**: The `gh project list` command does NOT accept --repo flag. Only use --owner flag.

```bash
# List all projects for an owner (CORRECT)
gh project list --owner jwitchel

# View project details (replace PROJECT_NUMBER with actual number)
gh project view PROJECT_NUMBER --owner jwitchel
```

### Accessing Issues
```bash
# List all issues in the repository
gh issue list --repo jwitchel/test-repo --limit 100

# View specific issue details
gh issue view ISSUE_NUMBER --repo jwitchel/test-repo

# Search for specific tasks
gh issue list --repo jwitchel/test-repo --search "Sprint 1"
```

## Project Structure

### Sprints and Milestones
The project is organized into 7 sprints:
- **Sprint 1**: Foundation Setup (Issues #4-7)
- **Sprint 2**: Email Integration (Issues #8-12)
- **Sprint 3**: Tone Analysis Engine (Issues #13-17)
- **Sprint 4**: Draft Generation (Issues #18-21)
- **Sprint 5**: Testing & Error Handling (Issues #22-24)
- **Sprint 6**: Polish & Optimization (Issues #25-28)
- **Sprint 7**: Production Readiness (Issues #29-33)

### Additional Tasks
- **Issue #35**: Relationship Categorization UI (added after initial sprint planning)

## Important Configuration Notes
- **Docker Ports** (non-standard to avoid conflicts):
  - PostgreSQL: 5434 (instead of 5432)
  - Redis: 6380 (instead of 6379)
- Project structure: Next.js app at repository root (not in subdirectory)
- Node.js dependencies already installed - run `npm install` after cloning

## Common Task Operations

### Updating Task Status
```bash
# Move task to "In Progress"
gh project item-edit --owner jwitchel --id ITEM_ID --field-id STATUS_FIELD_ID --project-id PROJECT_ID --text "In Progress"

# Mark task as completed
gh project item-edit --owner jwitchel --id ITEM_ID --field-id STATUS_FIELD_ID --project-id PROJECT_ID --text "Done"
```

### Editing Task Content

**IMPORTANT**: NEVER add comments to issues unless specifically instructed by the user. Always update subtask checkboxes directly in the main issue body using `gh issue edit`.

```bash
# Edit issue body/description (preferred method for updating subtasks)
gh issue edit ISSUE_NUMBER --repo jwitchel/test-repo --body "New content here"

# Add comments ONLY when explicitly requested by user
gh issue comment ISSUE_NUMBER --repo jwitchel/test-repo --body "Progress update..."
```

### Creating New Tasks
```bash
# Create a new issue and add to project
gh issue create --repo jwitchel/test-repo --title "Task Title" --body "Task description" --project PROJECT_NUMBER
```

## Key Architecture Decisions

### Technology Stack
- **Frontend**: Next.js (port 3000) with shadcn/ui components
- **Backend**: Express.js API (port 3001) with better-auth
- **WebSocket**: Real-time updates (port 3002)
- **Database**: PostgreSQL (Docker)
- **Queue**: BullMQ with Redis (Docker)
- **Email**: IMAP integration with node-imap

### Development Setup
- Docker runs PostgreSQL and Redis only
- Next.js and Express run locally (not in Docker) for easier debugging
- Authentication is centralized in Express API

### Important Architecture Notes
1. **Authentication**: All auth handled by Express API using better-auth
2. **Real-time Logging**: WebSocket connections for debugging IMAP, parsing, tone analysis
3. **Relationship System**: Category-based (not individual-based) with user-defined mappings
4. **UI Components**: Always use shadcn/ui for consistency

## UI Components (shadcn/ui)

The project uses shadcn/ui with Tailwind CSS v4 and the Neutral color theme. Components are initialized with oklch color values for better color accuracy.

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
- Alert component has custom success and info variants
- Toast notifications use Sonner instead of the deprecated toast component

## Git Workflow

### Branch Naming Convention
Each task should create a feature branch:
```bash
git checkout -b task-X.X-description
# Examples:
# task-1.1-nextjs-init
# task-2.3-imap-integration
# task-3.4-tone-api
```

### Task Workflow
1. Create feature branch at task start
2. Work on the branch throughout the task
3. Create PR when ready for review
4. Merge to main after approval

### Task Completion Checklist
1. Create feature branch (already documented)
2. Complete all subtasks - mark with [x] in issue body
3. Run validation commands before committing
4. Commit with descriptive messages
5. Push branch and create PR
6. After PR merge:
   - `git checkout main && git pull origin main`
   - `git branch -d feature-branch-name`
   - Issue should auto-close from PR

## Testing Commands
When completing tasks, always run:
```bash
# Linting
npm run lint

# Type checking  
npm run typecheck

# Tests (if available)
npm test
```

## Useful GitHub CLI Commands

### Project Management
```bash
# List project fields (to get field IDs)
gh project field-list PROJECT_NUMBER --owner jwitchel

# List items in project
gh project item-list PROJECT_NUMBER --owner jwitchel --limit 100

# Archive completed items
gh project item-archive PROJECT_NUMBER --owner jwitchel --id ITEM_ID
```

### Bulk Operations
```bash
# List all issues with specific label
gh issue list --repo jwitchel/test-repo --label "Sprint 3"

# Export issues to JSON
gh issue list --repo jwitchel/test-repo --json number,title,body,labels --limit 100 > issues.json
```

## Project Files
- **complete_project_plan.md**: Master project specification document
- **CLAUDE.md**: This file - instructions for Claude
- **.github/**: GitHub Actions workflows (when created)
- **src/**: Source code directory (when created)

## Quick Reference

### Find Project Number
```bash
gh project list --owner jwitchel
```

### View All Tasks
```bash
gh issue list --repo jwitchel/test-repo --limit 50
```

### Start Working on a Task
```bash
# View task details
gh issue view ISSUE_NUMBER --repo jwitchel/test-repo

# Create feature branch
git checkout -b task-X.X-description

# Update task status in project (if needed)
# First get the item ID and field IDs using project commands above
```

## Notes for Future Sessions
- The project uses GitHub Issues #4-35 for task tracking
- All tasks are in the "Backlog" status initially
- Each task has detailed subtasks, code examples, and acceptance criteria
- Authentication architecture uses Option 1 (centralized in Express)
- Real-time logging is emphasized throughout for debugging
- Always use shadcn/ui components for UI consistency
- **GitHub CLI**: Remember `gh project list` does NOT accept --repo flag, only --owner
- **Subtask Updates**: Always update subtasks in issue body, never use comments unless requested