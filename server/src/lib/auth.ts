import { betterAuth } from 'better-auth';
import { pool } from './db';
import { sharedConnection } from './redis-connection';
import crypto from 'crypto';
import { preferencesService } from './preferences-service';
import { encrypt } from './crypto';

const auth = betterAuth({
  database: pool,
  baseURL: process.env.APP_URL!,
  secondaryStorage: {
    get: async (key) => {
      return sharedConnection.get(key);
    },
    set: async (key, value, ttl) => {
      if (ttl) {
        await sharedConnection.set(key, value, 'EX', ttl);
      } else {
        await sharedConnection.set(key, value);
      }
    },
    delete: async (key) => {
      await sharedConnection.del(key);
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disable for development
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectURI: `${process.env.APP_URL!}/api/auth/callback/google`,
      scope: ['openid', 'email', 'profile', 'https://mail.google.com/'],
      accessType: 'offline',
      prompt: 'consent',
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60, // 1 minute (Redis makes cache misses cheap)
    },
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
    crossSubDomainCookies: {
      enabled: false,
    },
    defaultCookieAttributes: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Initialize default preferences for new users
          // Must use after hook because better-auth's adapter doesn't know about custom columns
          await pool.query(
            `UPDATE "user" SET preferences = $2 WHERE id = $1`,
            [user.id, JSON.stringify(preferencesService.getDefaultPreferences())]
          );
          console.log('[auth] Initialized preferences for new user:', user.email);
        },
      },
    },
    account: {
      create: {
        after: async (account, context): Promise<void> => {
          // Only process Google OAuth (the only provider with mail scope)
          if (account.providerId !== 'google') {
            return;
          }

          // Context may be null in some edge cases
          if (!context) {
            console.warn('[auth] account.create.after: context is null, cannot create email_account');
            return;
          }

          // Get the user's email from the user table
          const user = await context.context.internalAdapter.findUserById(account.userId);
          if (!user) {
            console.error('[auth] account.create.after: user not found for userId:', account.userId);
            return;
          }

          const userEmail = user.email;

          // Check if email_account already exists for this user+email combo
          const existing = await pool.query(
            'SELECT id FROM email_accounts WHERE user_id = $1 AND email_address = $2',
            [account.userId, userEmail]
          );

          if (existing.rows.length > 0) {
            console.log('[auth] email_account already exists for:', userEmail);
            return;
          }

          // Calculate token expiration
          const expiresAt = account.accessTokenExpiresAt
            ? new Date(account.accessTokenExpiresAt)
            : new Date(Date.now() + 24 * 3600 * 1000); // Default 24 hours

          // Encrypt tokens before storing
          const encryptedAccessToken = account.accessToken ? encrypt(account.accessToken) : null;
          const encryptedRefreshToken = account.refreshToken ? encrypt(account.refreshToken) : null;

          // Create the email_account with OAuth credentials (monitoring_enabled defaults to false)
          await pool.query(
            `INSERT INTO email_accounts
             (user_id, email_address, imap_host, imap_port, imap_username,
              oauth_provider, oauth_refresh_token, oauth_access_token,
              oauth_token_expires_at, oauth_user_id, sent_folder)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              account.userId,
              userEmail,
              process.env.GMAIL_IMAP_HOST!,
              parseInt(process.env.GMAIL_IMAP_PORT!, 10),
              userEmail,
              'google',
              encryptedRefreshToken,
              encryptedAccessToken,
              expiresAt,
              userEmail,
              process.env.GMAIL_SENT_FOLDER!
            ]
          );

          console.log('[auth] Created email_account for OAuth user:', userEmail);
        },
      },
    },
  },
  redirects: {
    afterSignIn: process.env.OAUTH_CALLBACK_URI!,
    // Redirect to signin page with error param - signin page shows toast
    afterError: '/signin',
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS!.split(','),
});

// Named export
export { auth };

// Default export for CLI
export default auth;