# AI Email Assistant

An AI-powered email assistant that generates email reply drafts matching your personal writing tone. Built with Next.js, Express.js, and better-auth.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- PostgreSQL client (optional, for direct DB access)

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/jwitchel/test-repo.git
   cd test-repo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   cp .env.example .env.local
   ```

   Update `.env` with your values:
   ```env
   # Database (using Docker PostgreSQL on port 5434)
   DATABASE_URL=postgresql://postgres:postgres@localhost:5434/aiemaildb
   
   # Redis (using Docker Redis on port 6380)
   REDIS_URL=redis://localhost:6380
   
   # Authentication
   BETTER_AUTH_SECRET=your-secret-key-here
   ENCRYPTION_KEY=your-encryption-key-here
   
   # API URL for frontend
   NEXT_PUBLIC_API_URL=http://localhost:3002
   ```

4. **Start Docker services**
   ```bash
   docker compose up -d
   ```
   
   This starts:
   - PostgreSQL on port 5434 (non-standard to avoid conflicts)
   - Redis on port 6380 (non-standard to avoid conflicts)

5. **Initialize the database**
   ```bash
   npm run db:test
   ```

6. **Start the development servers**
   ```bash
   npm run dev:all
   ```
   
   This runs:
   - Next.js frontend on http://localhost:3001
   - Express.js backend on http://localhost:3002

7. **Seed test data (optional)**
   ```bash
   npm run seed
   ```
   
   This creates both database users and email accounts:
   - user1@testmail.local / testpass123
   - user2@testmail.local / testpass456
   
   Alternative commands:
   ```bash
   npm run seed:db    # Create only database test users
   npm run seed:mail  # Create only email test accounts
   ```

## 📁 Project Structure

```
test-repo/
├── src/                    # Next.js frontend source
│   ├── app/               # App router pages
│   ├── components/        # React components
│   ├── lib/              # Utilities and contexts
│   └── hooks/            # Custom React hooks
├── server/                # Express.js backend
│   ├── src/              # Server source code
│   │   ├── routes/       # API routes
│   │   └── lib/          # Server utilities
│   └── tsconfig.json     # Server TypeScript config
├── scripts/               # Utility scripts
├── docker-compose.yml     # Docker services config
└── package.json          # Project dependencies
```

## 🛠️ Available Scripts

```bash
# Development
npm run dev              # Start Next.js frontend (port 3001)
npm run server          # Start Express backend (port 3002)
npm run dev:all         # Start both frontend and backend

# Docker & Database
docker compose up -d     # Start PostgreSQL, Redis & test mail server
docker compose down      # Stop all services
npm run db:test         # Test database connection
npm run seed            # Create test users (DB + email accounts)

# Code Quality
npm run lint            # Run ESLint
npm run build          # Build Next.js for production
npm run server:build   # Build Express server

# Testing
npm test               # Run tests (when available)
```

## 🔑 Authentication

The project uses [better-auth](https://www.better-auth.com/) for authentication with:
- Email/password authentication
- Secure httpOnly cookie sessions
- Protected routes with automatic redirects
- Cross-origin authentication between frontend (3001) and backend (3002)

### Authentication Flow
1. User signs up/signs in at `/signup` or `/signin`
2. Backend creates secure session cookie
3. Protected routes (e.g., `/dashboard`) require authentication
4. Unauthenticated users are redirected to sign in

## 🎨 UI Components

The project uses [shadcn/ui](https://ui.shadcn.com/) components with:
- **Zinc** color palette for neutral elements
- **Indigo** color palette for primary actions
- Pre-configured components including Button, Card, Form, Alert, etc.
- Toast notifications via custom `useToast()` hook

View all components at http://localhost:3001/components-test

## 📊 Current Project Status

### ✅ Sprint 1 Completed
- [x] Task 1.1: Next.js initialization with TypeScript
- [x] Task 1.2: Docker setup (PostgreSQL, Redis) 
- [x] Task 1.3: shadcn/ui component library setup
- [x] Task 1.4a: Express.js API setup with better-auth
- [x] Task 1.4b: Frontend authentication implementation

### 🚧 What's Working
- Full authentication system (sign up, sign in, sign out)
- Protected routes with session management
- PostgreSQL database with better-auth tables
- Express.js API server with CORS support
- Next.js frontend with TypeScript
- shadcn/ui components with custom theme

### 📋 What's Next
- Sprint 2: Email Integration (IMAP setup, email account management)
- Sprint 3: Tone Analysis Engine
- Sprint 4: Draft Generation
- Sprint 5: Testing & Error Handling
- Sprint 6: Polish & Optimization
- Sprint 7: Production Readiness

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts**
   - PostgreSQL uses port 5434 (not standard 5432)
   - Redis uses port 6380 (not standard 6379)
   - Next.js uses port 3001 (not standard 3000)
   - Express uses port 3002

2. **Database connection errors**
   - Ensure Docker is running: `docker compose ps`
   - Check logs: `docker compose logs postgres`
   - Verify connection: `npm run db:test`

3. **Authentication errors**
   - Ensure both servers are running: `npm run dev:all`
   - Check NEXT_PUBLIC_API_URL is set to http://localhost:3002
   - Clear browser cookies if session issues persist

4. **Missing environment variables**
   - Copy `.env.example` to both `.env` and `.env.local`
   - Generate secure keys for BETTER_AUTH_SECRET and ENCRYPTION_KEY
   - Ensure DATABASE_URL uses port 5434

## 🏗️ Architecture Decisions

- **Monorepo structure**: Frontend and backend in same repository
- **Authentication**: Centralized in Express API using better-auth
- **Database**: PostgreSQL for all data (no separate auth DB)
- **Session management**: Secure httpOnly cookies (no JWT)
- **Real-time updates**: WebSocket support for email processing logs
- **Queue system**: BullMQ with Redis for background jobs
- **Email parsing**: Uses [email-reply-parser](https://github.com/crisp-oss/email-reply-parser) for extracting user content
- **HTML conversion**: Uses [html-to-text](https://www.npmjs.com/package/html-to-text) for reliable HTML parsing

## 🔌 Real-time Features

### WebSocket Integration
The application includes real-time logging for email processing operations through WebSocket connections. This provides immediate visibility into:

- IMAP operations (connect, login, fetch, etc.)
- Email parsing and text extraction
- Processing metrics and performance data

For detailed information about the WebSocket architecture and integration, see [server/src/websocket/INTEGRATION.md](server/src/websocket/INTEGRATION.md).

**Demo Page**: Visit http://localhost:3001/imap-logs-demo after signing in to see the real-time logging in action.

## 🤝 Contributing

This project uses GitHub Issues and Projects for task management. Each task:
- Has a feature branch (e.g., `task-1.4b-auth-frontend`)
- Includes detailed subtasks in the issue description
- Requires PR review before merging to main

## 📝 License

Private project - not for public distribution.