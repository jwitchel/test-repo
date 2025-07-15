This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Docker Setup

This project uses Docker for PostgreSQL and Redis. To start the services:

```bash
docker compose up -d
```

**Note: Non-standard ports are used to avoid conflicts:**
- PostgreSQL: Port `5434` (instead of default 5432)
- Redis: Port `6380` (instead of default 6379)

### Docker Commands

```bash
# Start services
docker compose up -d

# Check service health
docker compose ps

# Test connections
./test-docker.sh

# View logs
docker compose logs postgres
docker compose logs redis

# Stop services
docker compose down
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## UI Components

This project uses [shadcn/ui](https://ui.shadcn.com/) components with Zinc base colors and Indigo accent colors. The following components are pre-installed and ready to use:

- **Button** - Various button styles (default, secondary, destructive, outline, ghost, link)
- **Card** - Container components with header, content, and footer sections
- **Input** & **Label** - Form input elements
- **Alert** - Notification alerts with default, success, info, and destructive variants
- **Accordion** - Collapsible content sections
- **Badge** - Small status indicators
- **Skeleton** - Loading placeholder components
- **Dialog** - Modal dialogs
- **Form** - React Hook Form integration
- **Sonner** - Toast notifications (replaces deprecated toast component)

### Toast Notifications

The project includes a custom toast hook for easy notifications:

```typescript
import { useToast } from "@/hooks/use-toast"

const { success, error, info } = useToast()

// Usage
success("Operation completed!")
error("Something went wrong!")
info("Here's some information")
```

### Component Examples

View all components in action by visiting `/components-test` when running the development server.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
