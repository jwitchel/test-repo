# AI Email Assistant - Complete Project Plan

## Project Overview

This application generates AI-powered email reply drafts that mirror the user's personal writing tone and style. The system learns from the user's historical sent emails to create contextually appropriate responses for different relationship types (friends, family, colleagues, external contacts). Generated drafts appear in the user's email client for review and sending, maintaining the natural email workflow while providing AI assistance.

## Core Architecture Decisions

### Email Processing Approach
- **Read-only IMAP integration**: System only reads emails and creates drafts, never sends emails
- **Server-side processing**: All tone analysis and draft generation occurs on our servers, not client-side
- **Client-agnostic design**: Works with any IMAP-compatible email client (Gmail, Outlook, Apple Mail)
- **No browser plugins required**: Operates entirely through IMAP protocol

### User Experience Philosophy
- **User retains sending control**: AI generates drafts, user reviews and sends manually
- **Invisible operation**: Only evidence in email client is the generated draft in "AI-Ready" folder
- **Natural workflow**: Edit and send using existing email client interface

## Technology Stack

### Frontend
- **React** with **shadcn/ui** components
- **Tailwind CSS** for styling
- **SWR** for data fetching

### Backend
- **Node.js** with **Express**
- **better-auth** for authentication
- **PostgreSQL** for production data storage
- **BullMQ** with **Redis** for background job processing
- **Highland.js** for email processing pipelines

### Email Processing Libraries
- **node-imap** (mscdex/node-imap) for IMAP operations
- **emailreplyparser** for extracting original content from reply chains
- **compromise** for natural language analysis
- **mailparser** for email parsing

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  subscription_tier VARCHAR(50) DEFAULT 'free',
  is_active BOOLEAN DEFAULT true
);
```

### Email Accounts Table
```sql
CREATE TABLE email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email_address VARCHAR(255) NOT NULL,
  imap_host VARCHAR(255) NOT NULL,
  imap_port INTEGER NOT NULL,
  imap_username VARCHAR(255) NOT NULL,
  imap_password_encrypted TEXT NOT NULL,
  smtp_host VARCHAR(255),
  smtp_port INTEGER,
  is_active BOOLEAN DEFAULT true,
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tone Profiles Table
```sql
CREATE TABLE tone_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL,
  profile_data JSONB NOT NULL,
  emails_analyzed INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);
```

### Draft Tracking Table
```sql
CREATE TABLE draft_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email_account_id UUID REFERENCES email_accounts(id) ON DELETE CASCADE,
  original_message_id VARCHAR(255) NOT NULL,
  draft_message_id VARCHAR(255) NOT NULL,
  generated_content TEXT NOT NULL,
  relationship_type VARCHAR(50),
  context_data JSONB,
  user_sent_content TEXT,
  edit_analysis JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP
);
```

## Tone Profile Data Structure

### Profile Schema
The `profile_data` JSONB field stores relationship-specific tone analysis:

```javascript
{
  stats: {
    avgWordsPerEmail: 15.4,
    avgSentencesPerEmail: 2.3,
    totalEmails: 245
  },
  patterns: {
    phrases: [
      { text: "FWIW", frequency: 45, context: "opinion_prefix", confidence: 0.8 },
      { text: "kk", frequency: 23, context: "agreement", confidence: 0.9 }
    ],
    sentenceStarters: [
      { text: "Just wanted to", frequency: 12 },
      { text: "Quick question", frequency: 8 }
    ],
    closings: [
      { text: "Thanks!", frequency: 89 },
      { text: "Best", frequency: 34 }
    ]
  },
  style: {
    formality: 0.6,
    contractions: 0.8,
    slangUsage: 0.3,
    enthusiasmLevel: 0.4,
    preferredLength: 0.7
  }
}
```

### Relationship Types
- **friends**: Casual tone, high slang usage, informal closings
- **family**: Warm but varied formality, emotional expressions
- **colleagues**: Professional but familiar, business terminology
- **external**: Formal tone, polite language, structured format

## Email Processing Pipeline

### Initial Tone Profile Building
1. **Historical Analysis**: Process last 1000 sent emails via IMAP
2. **Relationship Detection**: Categorize recipients using domain patterns, contact lists, and content analysis
3. **Content Extraction**: Use `emailreplyparser` to extract original content from reply chains
4. **Linguistic Analysis**: Extract phrases, sentence patterns, and style markers using `compromise`
5. **Profile Generation**: Create relationship-specific tone profiles stored in database

### Real-time Email Processing
1. **Inbox Monitoring**: Use IMAP IDLE to detect new incoming emails
2. **Server Processing**: Send email data to server for analysis and draft generation
3. **Draft Creation**: Generate reply using LLM with appropriate tone profile
4. **IMAP Draft Storage**: Create properly threaded draft in "INBOX.AI-Ready" folder

### Highland.js Pipeline Implementation
```javascript
function createEmailPipeline(imapConfig) {
  return _(emailStream)
    .map(parseEmailMessage)
    .filter(email => shouldProcessEmail(email))
    .map(email => detectRelationship(email))
    .map(email => sendToServerForProcessing(email))
    .filter(response => response.success)
    .each(response => appendDraftToFolder(response.draft, 'INBOX.AI-Ready'));
}
```

## Learning and Improvement System

### Edit Detection Strategy
When users send emails, the system compares the final sent content with the generated draft to identify:
- **Unmodified**: Draft sent as-is (positive reinforcement)
- **Minor edits**: Small adjustments to tone or length
- **Major edits**: Significant content or style changes
- **Complete rewrites**: Draft was completely replaced

### Edit Analysis Implementation
```javascript
function analyzeEdits(generatedContent, actualSent) {
  const similarity = calculateTextSimilarity(generated, actual);
  
  if (similarity > 0.95) return { editType: 'unmodified' };
  if (similarity > 0.80) return { editType: 'minor_edit', details: analyzeMinorEdits() };
  if (similarity > 0.40) return { editType: 'major_edit', details: analyzeMajorEdits() };
  return { editType: 'completely_rewritten' };
}
```

### Profile Updates
- **Positive reinforcement**: Increase confidence scores for successful patterns
- **Negative feedback**: Reduce confidence for edited patterns
- **Pattern learning**: Add new phrases and styles from user edits
- **Relationship refinement**: Adjust formality and tone based on edit patterns

## IMAP Implementation Details

### Draft Message Format
```javascript
{
  headers: {
    'Message-ID': '<unique-id@domain.com>',
    'In-Reply-To': '<original-message-id>',
    'References': '<thread-references>',
    'To': 'recipient@example.com',
    'Subject': 'Re: Original Subject',
    'Date': new Date().toUTCString()
  },
  flags: ['\\Draft'],
  body: 'Generated reply content'
}
```

### Threading Requirements
- **In-Reply-To**: Must match original message ID for proper threading
- **References**: Include full conversation thread references
- **Subject**: Prepend "Re:" if not already present

### Folder Management
- **INBOX.AI-Ready**: Contains generated drafts ready for user review
- **INBOX.Sent**: Monitored for learning from user's actual sends
- **INBOX**: Monitored for new incoming messages requiring responses

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login
- `GET /api/auth/session` - Get current session

### Email Account Management
- `POST /api/email-accounts` - Connect new email account
- `GET /api/email-accounts` - List user's connected accounts
- `DELETE /api/email-accounts/:id` - Remove email account

### Tone Profile Management
- `POST /api/build-tone-profile` - Trigger initial tone analysis
- `GET /api/tone-profile` - Get current tone profile
- `GET /api/learning-insights` - Get performance metrics and learning data

### Background Processing
- `POST /api/process-email` - Process incoming email for draft generation
- `POST /api/learn-from-edit` - Process user edit for learning

## Background Job Processing

### Job Types
1. **build-tone-profile**: Initial analysis of historical emails
2. **monitor-inbox**: Continuous IMAP monitoring for new emails
3. **process-new-email**: Generate draft for new incoming email
4. **learn-from-edit**: Update tone profile based on user edits

### Queue Configuration
```javascript
const emailQueue = new Queue('email-processing', {
  connection: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: 'exponential'
  }
});
```

## Frontend Components

### Dashboard Components
- **EmailAccountSetup**: IMAP configuration form with connection testing
- **ToneProfileCard**: Visual display of tone analysis for each relationship type
- **RecentDraftsCard**: List of recently generated drafts and their status
- **LearningInsightsCard**: Performance metrics and improvement trends

### Key React Patterns
- **SWR for data fetching**: Real-time updates of tone profiles and draft status
- **Form validation**: Email credential validation with error handling
- **Progress indicators**: Visual feedback during tone profile building
- **Toast notifications**: Success/error feedback for user actions

## LLM Integration Points

### Draft Generation Context
```javascript
function generateContextualPrompt(message, recipientEmail, toneProfile) {
  const relationship = detectRelationshipType(recipientEmail);
  const profile = toneProfile.profiles[relationship];
  
  return `
Respond in the style of someone who:
- Uses phrases: ${profile.patterns.phrases.map(p => p.text).join(', ')}
- Formality level: ${profile.style.formality}
- Average length: ${profile.stats.avgWordsPerEmail} words
- Relationship context: ${relationship}
`;
}
```

### Relationship Detection Logic
- **Domain analysis**: Company domains for colleagues, personal domains for friends
- **Contact pattern matching**: Name patterns, frequency of communication
- **Content analysis**: Language formality, greeting/closing patterns
- **Time-based patterns**: Business hours vs. personal time communication

## Deployment Architecture

### Development Setup
```yaml
# docker-compose.yml
services:
  frontend:
    build: .
    ports: ["3000:3000"]
  backend:
    build: .
    ports: ["3001:3001"]
  worker:
    command: npm run worker
  postgres:
    image: postgres:15
  redis:
    image: redis:7
```

### Production Considerations
- **Frontend**: Deploy to Vercel or similar static hosting
- **Backend API**: Deploy to Railway, Render, or AWS
- **Background Workers**: Separate deployment for email processing workers
- **Database**: Managed PostgreSQL instance
- **Redis**: Managed Redis instance for job queues

## Security Implementation

### Email Credential Storage
- **Encryption**: Use AES-256 encryption for stored IMAP passwords
- **Key management**: Environment-based encryption keys, never committed to code
- **Access control**: Credentials only accessible by background workers

### Data Privacy
- **Email content**: Process on secure servers, never log email content
- **Tone profiles**: Store only aggregated patterns, not raw email text
- **User isolation**: Complete tenant isolation at database level

## Testing Strategy

### Unit Tests
- **Tone analysis functions**: Test phrase extraction and pattern recognition
- **Edit detection**: Test similarity calculations and edit categorization
- **IMAP operations**: Mock IMAP connections for draft creation testing

### Integration Tests
- **Email pipeline**: End-to-end testing with test IMAP accounts
- **Learning system**: Verify tone profile updates from simulated user edits
- **API endpoints**: Test all CRUD operations and authentication flows

### Manual Testing Protocol
1. **Connect test email account** with existing email history
2. **Verify tone profile generation** with expected relationship categories
3. **Send test email to monitored account** and verify draft generation
4. **Edit and send draft** to verify learning system updates

---

# Development Sprint Plan

## Sprint 1: Foundation & Database Setup

### Task 1.1: Project Initialization
**Labels:** `sprint-1` `setup` `frontend`

#### Description
Initialize the Next.js project with all required dependencies and basic structure.

#### Subtasks
- [ ] Create new Next.js project with TypeScript
  ```bash
  npx create-next-app@latest ai-email-assistant --typescript --tailwind --eslint --app
  ```
- [ ] Install required dependencies
  ```bash
  npm install @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-button
  npm install class-variance-authority clsx tailwind-merge lucide-react
  npm install swr better-auth express cors pg
  npm install highland imap emailreplyparser compromise mailparser
  npm install bullmq ioredis bcryptjs crypto-js
  npm install --save-dev @types/node @types/imap @types/highland
  ```
- [ ] Set up project structure
  ```
  src/
  ├── app/
  ├── components/ui/
  ├── lib/
  ├── api/
  └── workers/
  ```
- [ ] Configure environment variables
  ```bash
  # .env.local
  DATABASE_URL=postgresql://user:pass@localhost:5432/aiemaildb
  REDIS_URL=redis://localhost:6379
  BETTER_AUTH_SECRET=your-secret-key
  ENCRYPTION_KEY=your-encryption-key
  NEXT_PUBLIC_API_URL=http://localhost:3001
  ```

#### Acceptance Criteria
- ✅ Next.js development server runs without errors (`npm run dev`)
- ✅ All dependencies installed and listed in package.json
- ✅ Folder structure matches requirements
- ✅ .env.example file created with all required variables
- ✅ TypeScript compilation works without errors

#### Definition of Done
- Code committed to `feature/project-init` branch
- Pull request created and reviewed
- Changes merged to main branch
- Development environment documented in README

### Task 1.2: Database Setup
**Labels:** `sprint-1` `database` `backend`

#### Description
Set up PostgreSQL database with complete schema and connection management.

#### Subtasks
- [ ] Install and configure PostgreSQL locally
- [ ] Create database schema file `db/schema.sql`
- [ ] Implement database connection module `src/lib/db.js`
  ```javascript
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  ```
- [ ] Create migration script to set up tables
- [ ] Implement basic CRUD functions for each table
- [ ] Test database connection and table creation

#### SQL Schema
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  subscription_tier VARCHAR(50) DEFAULT 'free',
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email_address VARCHAR(255) NOT NULL,
  imap_host VARCHAR(255) NOT NULL,
  imap_port INTEGER NOT NULL,
  imap_username VARCHAR(255) NOT NULL,
  imap_password_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Acceptance Criteria
- ✅ PostgreSQL database running locally
- ✅ All tables created with proper relationships
- ✅ Database connection module working
- ✅ CRUD operations tested for all tables
- ✅ Migration script runs successfully

### Task 1.3: shadcn/ui Setup
**Labels:** `sprint-1` `frontend` `ui`

#### Description
Configure shadcn/ui component library with custom theming.

#### Subtasks
- [ ] Initialize shadcn/ui configuration
  ```bash
  npx shadcn-ui@latest init
  ```
- [ ] Install required UI components
  ```bash
  npx shadcn-ui@latest add button card input toast
  npx shadcn-ui@latest add alert accordion badge
  npx shadcn-ui@latest add dialog form label
  ```
- [ ] Create custom theme configuration in `tailwind.config.js`
- [ ] Test component imports and styling
- [ ] Document component usage

#### Acceptance Criteria
- ✅ shadcn/ui properly configured
- ✅ All required components installed
- ✅ Custom theme applied consistently
- ✅ Test page showing all components working
- ✅ TypeScript types working for all components

### Task 1.4: Authentication Setup
**Labels:** `sprint-1` `backend` `auth`

#### Description
Configure better-auth for user authentication with database integration.

#### Subtasks
- [ ] Configure better-auth in `src/lib/auth.js`
- [ ] Create auth API routes in `src/api/auth/`
- [ ] Set up middleware for protected routes
- [ ] Create auth provider component
- [ ] Test user registration and login flows

#### Implementation Notes
- Integrate with PostgreSQL users table
- Set up proper session management
- Add password hashing with bcryptjs
- Create protected route middleware

#### Acceptance Criteria
- ✅ better-auth configured with database
- ✅ User registration working
- ✅ User login/logout working
- ✅ Protected routes require authentication
- ✅ Auth state persists across page refreshes

**Sprint 1 Checkpoint:**
- ✅ Next.js project running with shadcn/ui components
- ✅ PostgreSQL database with all tables created
- ✅ better-auth working with signup/signin
- ✅ Basic project structure and dependencies installed
- ✅ Environment variables configured

---

## Sprint 2: Core Backend API & Email Account Management

### Task 2.1: Express API Setup
**Labels:** `sprint-2` `backend` `api`

#### Description
Create Express.js API server with proper middleware and authentication integration.

#### Subtasks
- [ ] Create `src/api/server.js` with Express configuration
- [ ] Set up CORS and JSON middleware
- [ ] Integrate better-auth with Express
- [ ] Create error handling middleware
- [ ] Set up API route structure
- [ ] Add request logging middleware

#### API Structure
```
/api/
├── auth/          # Authentication endpoints
├── email-accounts/ # Email account management
├── tone-profile/  # Tone profile operations
└── process-email/ # Email processing
```

#### Acceptance Criteria
- ✅ Express server runs on port 3001
- ✅ CORS configured for frontend
- ✅ Authentication middleware working
- ✅ Error handling returns proper HTTP codes
- ✅ Request logging implemented

### Task 2.2: Email Account API Endpoints
**Labels:** `sprint-2` `backend` `api` `imap`

#### Description
Implement CRUD endpoints for email account management with IMAP credential testing.

#### Subtasks
- [ ] Create email encryption utilities in `src/lib/crypto.js`
  ```javascript
  const crypto = require('crypto-js');
  
  function encryptPassword(password) {
    return crypto.AES.encrypt(password, process.env.ENCRYPTION_KEY).toString();
  }
  ```
- [ ] Implement IMAP connection testing function
- [ ] Create `POST /api/email-accounts` endpoint
  - Validate IMAP credentials
  - Test connection before saving
  - Encrypt and store credentials
- [ ] Create `GET /api/email-accounts` endpoint
- [ ] Create `DELETE /api/email-accounts/:id` endpoint
- [ ] Add input validation and error handling

#### Security Requirements
- Encrypt passwords using AES-256
- Never return decrypted passwords in API responses
- Validate IMAP connection before storing credentials

#### Acceptance Criteria
- ✅ Email accounts can be created via API
- ✅ IMAP credentials tested before storage
- ✅ Passwords encrypted in database
- ✅ List and delete operations working
- ✅ Proper error handling for invalid credentials

### Task 2.3: IMAP Connection Module
**Labels:** `sprint-2` `backend` `imap`

#### Description
Create robust IMAP client wrapper for email operations.

#### Subtasks
- [ ] Create `src/lib/imap-client.js` wrapper
  ```javascript
  const Imap = require('imap');
  
  class ImapClient {
    constructor(config) {
      this.imap = new Imap({
        user: config.email,
        password: config.password,
        host: config.imapHost,
        port: config.imapPort,
        tls: true
      });
    }
  }
  ```
- [ ] Implement connection testing
- [ ] Implement folder listing
- [ ] Implement message fetching from sent folder
- [ ] Implement draft creation in specific folder
- [ ] Add connection pooling and error handling

#### IMAP Operations Required
- Connect/disconnect with proper cleanup
- List mailbox folders
- Fetch messages with filtering
- Append messages to folders (for drafts)
- Handle IDLE for real-time monitoring

#### Acceptance Criteria
- ✅ IMAP connections stable and reliable
- ✅ Can read from sent folder
- ✅ Can create drafts in specified folder
- ✅ Proper error handling for connection issues
- ✅ Connection pooling prevents resource leaks

### Task 2.4: Email Parsing Pipeline
**Labels:** `sprint-2` `backend` `email-processing`

#### Description
Create Highland.js pipeline for parsing and processing emails.

#### Subtasks
- [ ] Create `src/lib/email-parser.js`
- [ ] Integrate mailparser for email structure parsing
- [ ] Integrate emailreplyparser for original content extraction
- [ ] Create Highland.js pipeline for processing emails
- [ ] Test with sample email data
- [ ] Handle various email formats and edge cases

#### Pipeline Flow
1. Raw email → mailparser → structured email object
2. Structured email → emailreplyparser → original content only
3. Original content → relationship detection
4. Process in batches for efficiency

#### Acceptance Criteria
- ✅ Can parse complex email structures
- ✅ Extracts original content from reply chains
- ✅ Handles HTML and plain text emails
- ✅ Pipeline processes emails efficiently
- ✅ Error handling for malformed emails

**Sprint 2 Checkpoint:**
- ✅ Express API server running on port 3001
- ✅ Email account CRUD endpoints working
- ✅ IMAP connection testing functional
- ✅ Basic email parsing pipeline implemented
- ✅ Encrypted credential storage working

---

## Sprint 3: Tone Analysis & Profile Building

### Task 3.1: Natural Language Processing Setup
**Labels:** `sprint-3` `ai` `backend`

#### Description
Implement natural language processing for tone analysis using compromise.js.

#### Subtasks
- [ ] Create `src/lib/tone-analyzer.js`
- [ ] Implement phrase extraction using compromise
  ```javascript
  const nlp = require('compromise');
  
  function extractPhrases(text) {
    const doc = nlp(text);
    return {
      phrases: doc.match('#Acronym').out('array'),
      contractions: doc.contractions().out('array'),
      questions: doc.questions().out('array')
    };
  }
  ```
- [ ] Implement relationship detection logic
- [ ] Create tone profile data structure builder
- [ ] Test with sample email text

#### Analysis Features
- Extract common phrases and acronyms
- Detect formality level
- Count contractions vs formal language
- Identify sentence patterns
- Measure enthusiasm markers

#### Acceptance Criteria
- ✅ Can extract meaningful phrases from text
- ✅ Relationship detection categorizes correctly
- ✅ Tone metrics calculated accurately
- ✅ Profile data structure is consistent
- ✅ Performance acceptable for large text volumes

### Task 3.2: Tone Profile Database Operations
**Labels:** `sprint-3` `database` `backend`

#### Description
Implement database operations for storing and retrieving tone profiles.

#### Subtasks
- [ ] Create `src/lib/tone-profile-db.js`
- [ ] Implement tone profile storage functions
- [ ] Implement tone profile retrieval with caching
- [ ] Implement profile update and merging logic
- [ ] Add relationship-specific profile management
- [ ] Test database operations

#### Key Functions
- `storeToneProfile(userId, relationship, profileData)`
- `getToneProfile(userId, relationship)`
- `updateToneProfile(userId, relationship, updates)`
- `mergeToneProfiles(existing, new)`

#### Acceptance Criteria
- ✅ Tone profiles stored correctly in JSONB format
- ✅ Retrieval operations are fast with proper indexing
- ✅ Profile merging preserves important patterns
- ✅ Relationship-specific profiles isolated properly
- ✅ Error handling for malformed profile data

### Task 3.3: Historical Email Analysis
**Labels:** `sprint-3` `ai` `email-processing`

#### Description
Implement Highland pipeline for processing sent emails to build initial tone profiles.

#### Subtasks
- [ ] Create `src/lib/historical-analyzer.js`
- [ ] Implement Highland pipeline for processing sent emails
  ```javascript
  function createToneAnalysisPipeline(emailAccount) {
    return _(function(push, next) {
      // IMAP connection and email fetching
    })
    .map(parseEmailMessage)
    .map(extractOriginalContent)
    .map(detectRelationship)
    .map(analyzeToneFeatures)
    .batch(50)
    .map(aggregateToneData);
  }
  ```
- [ ] Implement relationship detection algorithms
- [ ] Build tone profile aggregation logic
- [ ] Test with real email account data

#### Relationship Detection Logic
- Domain analysis (company vs personal)
- Contact frequency patterns
- Language formality analysis
- Time-based communication patterns

#### Acceptance Criteria
- ✅ Can process 1000+ sent emails efficiently
- ✅ Relationship detection accuracy >80%
- ✅ Tone profiles reflect actual writing patterns
- ✅ Pipeline handles various email formats
- ✅ Memory usage remains reasonable during processing

### Task 3.4: Tone Profile API Endpoints
**Labels:** `sprint-3` `api` `backend`

#### Description
Create API endpoints for tone profile management and building.

#### Subtasks
- [ ] Create `POST /api/build-tone-profile` endpoint
- [ ] Create `GET /api/tone-profile` endpoint
- [ ] Create `GET /api/tone-profile/:relationship` endpoint
- [ ] Add progress tracking for tone profile building
- [ ] Implement caching for frequently accessed profiles
- [ ] Test API endpoints with frontend

#### Endpoint Specifications
```javascript
// POST /api/build-tone-profile
{
  emailAccountId: "uuid",
  options: {
    maxEmails: 1000,
    relationships: ["friends", "colleagues", "family", "external"]
  }
}

// GET /api/tone-profile
{
  profiles: {
    friends: { /* tone data */ },
    colleagues: { /* tone data */ },
    // ...
  },
  lastUpdated: "timestamp",
  totalEmailsAnalyzed: 1000
}
```

#### Acceptance Criteria
- ✅ Tone profile building can be triggered via API
- ✅ Progress tracking shows build status
- ✅ Profile retrieval returns structured data
- ✅ Caching improves response times
- ✅ Error handling for invalid requests

**Sprint 3 Checkpoint:**
- ✅ Tone analysis algorithms working
- ✅ Historical email processing pipeline functional
- ✅ Tone profiles being generated and stored
- ✅ API endpoints returning tone profile data
- ✅ Relationship detection categorizing contacts correctly

---

## Sprint 4: Frontend Dashboard Development

### Task 4.1: Dashboard Layout & Navigation
**Labels:** `sprint-4` `frontend` `ui`

#### Description
Create responsive dashboard layout with navigation and auth integration.

#### Subtasks
- [ ] Create `src/app/dashboard/layout.tsx`
- [ ] Create navigation component with proper auth checks
- [ ] Implement responsive layout with sidebar
- [ ] Add loading states and error boundaries
- [ ] Style with Tailwind CSS and shadcn components

#### Layout Requirements
- Responsive design (mobile, tablet, desktop)
- Persistent navigation sidebar
- User profile dropdown
- Loading states for async operations
- Error boundaries for graceful failures

#### Acceptance Criteria
- ✅ Dashboard layout responsive on all screen sizes
- ✅ Navigation shows only when authenticated
- ✅ Loading states provide good UX
- ✅ Error boundaries catch and display errors
- ✅ Consistent styling with design system

### Task 4.2: Email Account Management UI
**Labels:** `sprint-4` `frontend` `ui`

#### Description
Create user interface for connecting and managing email accounts.

#### Subtasks
- [ ] Create `src/components/email-account-setup.tsx`
  ```javascript
  export function EmailAccountSetup() {
    const [config, setConfig] = useState({
      email: '', imapHost: 'imap.gmail.com', imapPort: 993, password: ''
    });
    
    const handleConnect = async () => {
      const response = await fetch('/api/email-accounts', {
        method: 'POST',
        body: JSON.stringify(config)
      });
    };
  }
  ```
- [ ] Add form validation with proper error messages
- [ ] Implement connection testing with visual feedback
- [ ] Create email account list component
- [ ] Add delete functionality with confirmation dialog
- [ ] Test IMAP connection flow end-to-end

#### Form Features
- Auto-detect IMAP settings for common providers
- Real-time validation of email format
- Connection testing before saving
- Clear error messages for common issues
- Loading states during connection testing

#### Acceptance Criteria
- ✅ Users can connect Gmail, Outlook, and other IMAP accounts
- ✅ Form validation prevents invalid submissions
- ✅ Connection testing works reliably
- ✅ Error messages are helpful and actionable
- ✅ UI provides clear feedback for all operations

### Task 4.3: Tone Profile Visualization
**Labels:** `sprint-4` `frontend` `ui`

#### Description
Create visual components for displaying tone profile data and analysis progress.

#### Subtasks
- [ ] Create `src/components/tone-profile-card.tsx`
- [ ] Implement SWR data fetching
  ```javascript
  const { data: toneProfile, error } = useSWR('/api/tone-profile', fetcher);
  ```
- [ ] Create visual representations of tone metrics
- [ ] Add relationship-specific profile displays
- [ ] Implement progress indicators for profile building
- [ ] Style with cards and progress bars

#### Visualization Features
- Formality level progress bars
- Common phrases word cloud or list
- Email volume by relationship type
- Profile building progress indicator
- Last updated timestamps

#### Acceptance Criteria
- ✅ Tone profiles display clearly for each relationship type
- ✅ Visual metrics are easy to understand
- ✅ Profile building progress is visible
- ✅ Data updates in real-time
- ✅ Responsive design works on all devices

### Task 4.4: Dashboard Data Integration
**Labels:** `sprint-4` `frontend` `api-integration`

#### Description
Integrate dashboard components with backend APIs using SWR for real-time updates.

#### Subtasks
- [ ] Set up SWR configuration and error handling
- [ ] Create custom hooks for API calls
- [ ] Implement real-time data updates
- [ ] Add toast notifications for user actions
- [ ] Test data flow from backend to frontend
- [ ] Handle loading and error states gracefully

#### Custom Hooks
```javascript
// useEmailAccounts hook
function useEmailAccounts() {
  const { data, error, mutate } = useSWR('/api/email-accounts', fetcher);
  
  const addAccount = async (accountData) => {
    await fetch('/api/email-accounts', {
      method: 'POST',
      body: JSON.stringify(accountData)
    });
    mutate(); // Refresh data
  };
  
  return { accounts: data, error, addAccount };
}
```

#### Acceptance Criteria
- ✅ All API calls use consistent error handling
- ✅ Loading states provide good user experience
- ✅ Data updates automatically without page refresh
- ✅ Toast notifications confirm user actions
- ✅ Offline state handled gracefully

**Sprint 4 Checkpoint:**
- ✅ Complete dashboard UI with email account management
- ✅ Tone profile visualization working
- ✅ Real-time data updates via SWR
- ✅ User can connect email accounts and see tone analysis
- ✅ All CRUD operations working through UI

---

## Sprint 5: Background Job Processing & Email Monitoring

### Task 5.1: Redis & BullMQ Setup
**Labels:** `sprint-5` `backend` `jobs`

#### Description
Set up Redis and BullMQ for background job processing.

#### Subtasks
- [ ] Install and configure Redis locally
- [ ] Create `src/lib/queue.js` with BullMQ configuration
  ```javascript
  const { Queue, Worker } = require('bullmq');
  
  const emailQueue = new Queue('email-processing', {
    connection: { host: 'localhost', port: 6379 }
  });
  ```
- [ ] Set up job types and priorities
- [ ] Implement job retry and failure handling
- [ ] Test queue operations

#### Job Types
- `build-tone-profile`: Initial historical analysis
- `monitor-inbox`: Real-time email monitoring
- `process-new-email`: Generate draft for new email
- `learn-from-edit`: Update profile from user edits

#### Queue Configuration
```javascript
const queueConfig = {
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: 'exponential'
  }
};
```

#### Acceptance Criteria
- ✅ Redis running and accessible
- ✅ BullMQ queues operational
- ✅ Job retry logic working
- ✅ Failed jobs handled gracefully
- ✅ Job monitoring and logging

### Task 5.2: Email Processing Workers
**Labels:** `sprint-5` `backend` `workers`

#### Description
Create background workers for processing different types of email jobs.

#### Subtasks
- [ ] Create `src/workers/email-processor.js`
- [ ] Implement tone profile building worker
- [ ] Implement inbox monitoring worker
- [ ] Implement new email processing worker
- [ ] Add logging and error handling
- [ ] Test worker job processing

#### Worker Implementation
```javascript
const emailWorker = new Worker('email-processing', async (job) => {
  const { type, data } = job.data;
  
  switch(type) {
    case 'build-tone-profile':
      return await buildInitialToneProfile(data.userId);
    case 'process-new-email':
      return await processNewEmail(data.userId, data.emailData);
    case 'monitor-inbox':
      return await monitorUserInbox(data.userId);
  }
});
```

#### Acceptance Criteria
- ✅ Workers process jobs reliably
- ✅ Error handling prevents worker crashes
- ✅ Job progress tracking working
- ✅ Logging provides debugging information
- ✅ Worker scaling handles load

### Task 5.3: IMAP Monitoring Implementation
**Labels:** `sprint-5` `backend` `imap` `monitoring`

#### Description
Implement real-time IMAP monitoring using IDLE for detecting new emails.

#### Subtasks
- [ ] Create `src/lib/imap-monitor.js`
- [ ] Implement IMAP IDLE for real-time monitoring
  ```javascript
  function startImapMonitoring(emailAccount, onNewEmail) {
    const imap = new Imap(emailAccount.config);
    imap.once('ready', () => {
      imap.openBox('INBOX', false, () => {
        imap.on('mail', (numNewMsgs) => {
          // Process new messages
        });
        imap.idle();
      });
    });
  }
  ```
- [ ] Handle connection drops and reconnection
- [ ] Queue new emails for processing
- [ ] Test with live email accounts

#### Monitoring Features
- Real-time detection of new emails
- Automatic reconnection on connection drops
- Queue new emails for draft generation
- Monitor multiple email accounts simultaneously
- Handle IMAP server limitations

#### Acceptance Criteria
- ✅ New emails detected within seconds
- ✅ Connection drops handled gracefully
- ✅ Multiple accounts monitored simultaneously
- ✅ New emails queued for processing
- ✅ Resource usage remains reasonable

### Task 5.4: Background Job API Integration
**Labels:** `sprint-5` `api` `backend`

#### Description
Create API endpoints for managing background jobs and monitoring status.

#### Subtasks
- [ ] Create job queuing endpoints
- [ ] Add job status tracking
- [ ] Implement job progress updates
- [ ] Create job management dashboard
- [ ] Test background processing flow
- [ ] Add monitoring and alerting

#### Job Management Endpoints
- `POST /api/jobs/queue` - Queue new background job
- `GET /api/jobs/status/:jobId` - Get job status
- `GET /api/jobs/list` - List user's jobs
- `DELETE /api/jobs/:jobId` - Cancel job

#### Acceptance Criteria
- ✅ Jobs can be queued via API
- ✅ Job status tracking working
- ✅ Progress updates available in real-time
- ✅ Failed jobs can be retried
- ✅ Job management interface functional

**Sprint 5 Checkpoint:**
- ✅ Redis and BullMQ operational
- ✅ Background workers processing jobs
- ✅ IMAP monitoring detecting new emails
- ✅ Tone profile building running in background
- ✅ Job status visible in dashboard

---

## Sprint 6: Draft Generation & Learning System

### Task 6.1: LLM Integration Setup
**Labels:** `sprint-6` `ai` `backend`

#### Description
Integrate with LLM provider for contextual email reply generation.

#### Subtasks
- [ ] Choose LLM provider (OpenAI, Anthropic, etc.)
- [ ] Create `src/lib/llm-client.js`
- [ ] Implement prompt generation from tone profiles
  ```javascript
  function generateContextualPrompt(email, toneProfile, relationship) {
    const profile = toneProfile.profiles[relationship];
    return `Respond in the style of someone who:
    - Uses phrases: ${profile.patterns.phrases.map(p => p.text).join(', ')}
    - Formality level: ${profile.style.formality}
    - Average length: ${profile.stats.avgWordsPerEmail} words`;
  }
  ```
- [ ] Test prompt generation and LLM responses
- [ ] Handle API rate limits and errors

#### Prompt Engineering
Generate contextual prompts that include:
- User's common phrases and expressions
- Formality level for relationship type
- Typical response length
- Context from original email

#### Acceptance Criteria
- ✅ LLM API integration working
- ✅ Prompts generate appropriate responses
- ✅ Rate limiting handled gracefully
- ✅ Error handling for API failures
- ✅ Response quality acceptable for POC

### Task 6.2: Draft Creation System
**Labels:** `sprint-6` `backend` `email-processing`

#### Description
Implement system for creating properly formatted email drafts using IMAP.

#### Subtasks
- [ ] Create `src/lib/draft-generator.js`
- [ ] Implement email context analysis
- [ ] Create draft message formatting for IMAP
- [ ] Implement proper email threading (In-Reply-To, References)
- [ ] Test draft creation and IMAP storage

#### Draft Message Format
```javascript
function createDraftMessage(originalEmail, generatedReply, relationship) {
  return {
    headers: {
      'Message-ID': `<${generateUniqueId()}@${getUserDomain()}>`,
      'In-Reply-To': originalEmail.headers['message-id'],
      'References': buildReferencesChain(originalEmail),
      'To': originalEmail.from.address,
      'Subject': buildReplySubject(originalEmail.subject),
      'Date': new Date().toUTCString()
    },
    flags: ['\\Draft'],
    body: generatedReply
  };
}
```

#### Acceptance Criteria
- ✅ Drafts properly threaded in email clients
- ✅ All required headers included
- ✅ Draft formatting works across email clients
- ✅ IMAP storage successful
- ✅ Drafts appear in correct folder

### Task 6.3: Draft Tracking Implementation
**Labels:** `sprint-6` `backend` `learning`

#### Description
Implement system for tracking generated drafts and comparing with user's actual sends.

#### Subtasks
- [ ] Implement draft tracking database operations
- [ ] Create draft-to-send comparison system
- [ ] Monitor sent folder for user responses
- [ ] Implement edit detection algorithms
  ```javascript
  function analyzeEdits(generated, actual) {
    const similarity = calculateTextSimilarity(generated, actual);
    if (similarity > 0.95) return { editType: 'unmodified' };
    if (similarity > 0.80) return { editType: 'minor_edit' };
    return { editType: 'major_edit' };
  }
  ```
- [ ] Test edit detection with sample data

#### Edit Detection Categories
- **Unmodified**: Draft sent as-is (>95% similarity)
- **Minor edit**: Small adjustments (80-95% similarity)
- **Major edit**: Significant changes (40-80% similarity)
- **Complete rewrite**: Entirely different (<40% similarity)

#### Acceptance Criteria
- ✅ Drafts tracked in database with unique IDs
- ✅ Sent emails matched to original drafts
- ✅ Edit detection categorizes changes correctly
- ✅ Edit analysis provides actionable insights
- ✅ Tracking works across email clients

### Task 6.4: Learning System Implementation
**Labels:** `sprint-6` `ai` `learning`

#### Description
Implement machine learning system that updates tone profiles based on user edits.

#### Subtasks
- [ ] Create tone profile update algorithms
- [ ] Implement confidence scoring for patterns
- [ ] Add pattern reinforcement for successful drafts
- [ ] Create learning from edits logic
- [ ] Test learning system with simulated user behavior
- [ ] Add learning insights API endpoint

#### Learning Algorithm
```javascript
async function updateToneProfileFromEdits(editData, userId) {
  const { editAnalysis, sentContent } = editData;
  
  switch (editAnalysis.editType) {
    case 'unmodified':
      // Positive signal - reinforce patterns used
      await reinforceSuccessfulPatterns(toneProfile, relationship);
      break;
    case 'minor_edit':
      // Learn from specific adjustments
      await learnFromMinorAdjustments(toneProfile, editAnalysis.details);
      break;
    case 'major_edit':
      // Strong signal to adjust approach
      await adjustToneFromMajorEdits(toneProfile, sentContent);
      break;
  }
}
```

#### Acceptance Criteria
- ✅ Tone profiles improve with user feedback
- ✅ Confidence scores adjust based on success
- ✅ Failed patterns get reduced confidence
- ✅ New user patterns learned from edits
- ✅ Learning insights available via API

**Sprint 6 Checkpoint:**
- ✅ LLM generating contextual email replies
- ✅ Drafts appearing in IMAP "AI-Ready" folder
- ✅ Draft tracking operational
- ✅ Edit detection working
- ✅ Learning system updating tone profiles

---

## Sprint 7: Integration Testing & Polish

### Task 7.1: End-to-End Testing
**Labels:** `sprint-7` `testing`

#### Description
Comprehensive end-to-end testing of the complete system.

#### Subtasks
- [ ] Set up test email accounts (Gmail, Outlook)
- [ ] Test complete flow: new email → draft generation → user edit → learning
- [ ] Verify IMAP compatibility across email clients
- [ ] Test with various email formats and threading scenarios
- [ ] Load test with multiple users and email accounts

#### Test Scenarios
1. User registration and email account connection
2. Historical tone profile building
3. Real-time draft generation
4. User edit detection and learning
5. Multiple relationship types
6. Error recovery scenarios

#### Acceptance Criteria
- ✅ Complete user flow works end-to-end
- ✅ System handles real email volumes
- ✅ Compatible with major email clients
- ✅ Error scenarios handled gracefully
- ✅ Performance acceptable under load

### Task 7.2: Error Handling & Resilience
**Labels:** `sprint-7` `backend` `reliability`

#### Description
Implement comprehensive error handling and system resilience.

#### Subtasks
- [ ] Add comprehensive error handling to all API endpoints
- [ ] Implement graceful IMAP connection failure handling
- [ ] Add retry logic for failed background jobs
- [ ] Create user-friendly error messages
- [ ] Test system behavior under various failure conditions

#### Error Scenarios
- IMAP connection failures
- LLM API rate limits or outages
- Database connection issues
- Invalid email formats
- Authentication failures

#### Acceptance Criteria
- ✅ System degrades gracefully under failures
- ✅ Error messages help users resolve issues
- ✅ Background jobs retry automatically
- ✅ Data integrity maintained during failures
- ✅ System recovers automatically when possible

### Task 7.3: Performance Optimization
**Labels:** `sprint-7` `performance`

#### Description
Optimize system performance for production readiness.

#### Subtasks
- [ ] Optimize database queries with indexes
- [ ] Implement caching for frequently accessed data
- [ ] Optimize Highland pipelines for memory usage
- [ ] Add connection pooling for IMAP connections
- [ ] Performance test with large email volumes

#### Optimization Areas
- Database query performance
- IMAP connection management
- Memory usage during email processing
- API response times
- Background job throughput

#### Acceptance Criteria
- ✅ Database queries optimized with proper indexes
- ✅ Caching reduces API response times
- ✅ Memory usage stays within acceptable limits
- ✅ System handles 1000+ emails efficiently
- ✅ Background jobs process within reasonable time

### Task 7.4: User Experience Polish
**Labels:** `sprint-7` `frontend` `ux`

#### Description
Polish user experience and add helpful features for POC demonstration.

#### Subtasks
- [ ] Add detailed progress indicators for long-running operations
- [ ] Improve loading states and transitions
- [ ] Add helpful tooltips and onboarding flow
- [ ] Implement proper error recovery UX
- [ ] Test user experience with real users

#### UX Improvements
- Onboarding flow for first-time users
- Progress indicators for tone profile building
- Helpful error messages with suggested actions
- Smooth transitions and loading states
- Responsive design refinements

#### Acceptance Criteria
- ✅ Onboarding flow guides new users
- ✅ Progress indicators show system status
- ✅ Error recovery provides clear next steps
- ✅ All interactions feel smooth and responsive
- ✅ User testing validates experience

### Task 7.5: Deployment Preparation
**Labels:** `sprint-7` `deployment`

#### Description
Prepare system for production deployment.

#### Subtasks
- [ ] Create Docker configuration files
- [ ] Set up production environment variables
- [ ] Configure production database and Redis
- [ ] Set up monitoring and logging
- [ ] Create deployment scripts
- [ ] Test production deployment

#### Deployment Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

#### Acceptance Criteria
- ✅ Docker containers build and run successfully
- ✅ Production environment configured properly
- ✅ Database migrations work in production
- ✅ Monitoring and logging operational
- ✅ Deployment process documented

**Sprint 7 Checkpoint:**
- ✅ Complete system working end-to-end
- ✅ Error handling robust across all components
- ✅ Performance acceptable for POC use
- ✅ User experience polished and intuitive
- ✅ System ready for production deployment

---

## Final Validation Checklist

### Core Functionality
- [ ] User can register and authenticate
- [ ] User can connect email account with IMAP credentials
- [ ] System builds tone profile from historical sent emails
- [ ] System monitors inbox for new emails
- [ ] AI generates contextual reply drafts
- [ ] Drafts appear in email client's "AI-Ready" folder
- [ ] System learns from user edits to improve future drafts

### Technical Requirements
- [ ] All API endpoints respond correctly
- [ ] Database operations are reliable
- [ ] Background jobs process without errors
- [ ] IMAP operations work with major email providers
- [ ] Frontend displays real-time data updates
- [ ] Error handling provides meaningful feedback

### User Experience
- [ ] Onboarding flow is clear and complete
- [ ] Dashboard provides useful insights
- [ ] Email account setup process is straightforward
- [ ] System performance is acceptable
- [ ] Error messages are helpful and actionable

### Deployment Readiness
- [ ] Application can be deployed to production
- [ ] Environment configuration is documented
- [ ] Database migrations are tested
- [ ] Monitoring and logging are operational
- [ ] Security best practices are implemented