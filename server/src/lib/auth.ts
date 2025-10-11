import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Create PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const auth = betterAuth({
  database: pool,
  baseURL: process.env.BACKEND_URL!,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disable for development
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectURI: `${process.env.BACKEND_URL!}/api/auth/callback/google`,
      scope: ['openid', 'email', 'profile', 'https://mail.google.com/'],
      accessType: 'offline',
      prompt: 'consent',
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  redirects: {
    afterSignIn: process.env.OAUTH_CALLBACK_URI!,
    afterError: process.env.OAUTH_ERROR_REDIRECT_URI!,
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS!.split(','),
});

// Named export
export { auth };

// Default export for CLI
export default auth;