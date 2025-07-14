# AI Email Assistant Project - Claude Instructions

## Project Overview
This is an AI Email Assistant application that generates email reply drafts matching the user's personal writing tone. The project is managed through GitHub Issues and Projects.

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
- **Sprint 1**: Foundation Setup 
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
- Project structure: Next.js app at repository root (not in subdirectory)
- Node.js dependencies already installed - run `npm install` after cloning

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

### Important Architecture Notes
1. **Authentication**: All auth handled by Express API using better-auth
2. **Real-time Logging**: WebSocket connections for debugging IMAP, parsing, tone analysis
3. **Relationship System**: Category-based (not individual-based) with user-defined mappings
4. **UI Components**: Always use shadcn/ui for consistency

## Git Workflow

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
# task-2.3-imap-integration
# task-3.4-tone-api
```

### Task Workflow
1. Create feature branch at task start
2. Work on the branch throughout the task
3. Create PR when ready for review
4. Merge to main after approval

### Task Completion Checklist
1. Confirm you're on a feature branch
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

## Project Files
- **complete_project_plan.md**: Original master project specification document.  Some drift expected.
- **CLAUDE.md**: This file - instructions for Claude
- **.github/**: GitHub Actions workflows (when created)
- **src/**: Source code directory 

## Notes for Future Sessions
- All new tasks should be assigned to the project and given the "Backlog" status initially
- Each task has detailed subtasks, code examples, and acceptance criteria
- **GitHub CLI**: Remember `gh project list` does NOT accept --repo flag, only --owner
- **Subtask Updates**: Always update subtasks in issue body, never use comments unless requested
