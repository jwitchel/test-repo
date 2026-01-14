import { betterAuth } from 'better-auth';
import { pool } from './db';
import { sharedConnection } from './redis-connection';
import crypto from 'crypto';
import { preferencesService } from './preferences-service';
import { encrypt } from './crypto';
import { userAlertService } from './user-alert-service';
import {
  AlertType,
  AlertSeverity,
  SourceType,
  OnboardingSourceId,
} from '../types/user-alerts';

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

          // Create onboarding alerts
          await createOnboardingAlerts(user.id);

          console.log('[auth] Initialized preferences and onboarding for new user:', user.email);
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

          // Resolve onboarding alert for email account setup
          await userAlertService.resolveAlertsForSource(SourceType.ONBOARDING, OnboardingSourceId.EMAIL_ACCOUNT);
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

/**
 * Create onboarding setup alerts for a new user
 */
async function createOnboardingAlerts(userId: string): Promise<void> {
  const alerts = [
    {
      alertType: AlertType.SETUP_LLM_PROVIDER,
      sourceId: OnboardingSourceId.LLM_PROVIDER,
      sourceName: 'LLM Provider Setup',
      message: 'Add an AI provider (OpenAI, Anthropic, etc.) to enable draft generation',
      actionUrl: '/settings/llm-providers',
      actionLabel: 'Add Provider',
    },
    {
      alertType: AlertType.SETUP_EMAIL_ACCOUNT,
      sourceId: OnboardingSourceId.EMAIL_ACCOUNT,
      sourceName: 'Email Account Setup',
      message: 'Connect your email account to start monitoring for incoming messages',
      actionUrl: '/settings/email-accounts',
      actionLabel: 'Connect Email',
    },
    {
      alertType: AlertType.SETUP_FOLDERS,
      sourceId: OnboardingSourceId.FOLDERS,
      sourceName: 'Folder Configuration',
      message: 'Configure which folders to monitor and where to save drafts',
      actionUrl: '/settings?tab=services',
      actionLabel: 'Configure Folders',
    },
    {
      alertType: AlertType.SETUP_PROFILE,
      sourceId: OnboardingSourceId.PROFILE,
      sourceName: 'Set Up Your Profile',
      message: 'Add your name and signature for personalized email drafts',
      actionUrl: '/settings?tab=profile',
      actionLabel: 'Set Up Profile',
    },
    {
      alertType: AlertType.SETUP_RELATIONSHIPS,
      sourceId: OnboardingSourceId.RELATIONSHIPS,
      sourceName: 'Relationships',
      message: 'Add family, work contacts for better context in drafts',
      actionUrl: '/settings?tab=relationships',
      actionLabel: 'Add Relationships',
    },
    {
      alertType: AlertType.SETUP_TRAINING,
      sourceId: OnboardingSourceId.TRAINING,
      sourceName: 'Training',
      message: 'Train the AI on your writing style by reviewing sent emails',
      actionUrl: '/tone',
      actionLabel: 'Start Training',
    },
  ];

  for (const alert of alerts) {
    await userAlertService.createAlert({
      userId,
      alertType: alert.alertType,
      severity: AlertSeverity.INFO,
      sourceType: SourceType.ONBOARDING,
      sourceId: alert.sourceId,
      sourceName: alert.sourceName,
      message: alert.message,
      actionUrl: alert.actionUrl,
      actionLabel: alert.actionLabel,
    });
  }
}