import { createAuthClient } from 'better-auth/react'
import { adminClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: '',
  plugins: [adminClient()],
})

// Export social sign-in for Google OAuth
export const signInWithGoogle = () => {
  return authClient.signIn.social({
    provider: 'google',
    callbackURL: '/dashboard',
  });
};

// OAuth error codes mapped to user-friendly messages
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  unable_to_create_user: 'This email is already registered. Please sign in instead.',
  oauth_denied: 'Google sign-in was cancelled.',
  invalid_callback: 'Invalid authentication callback. Please try again.',
  invalid_state: 'Authentication session expired. Please try again.',
  oauth_config: 'Google sign-in is not configured correctly.',
  token_exchange: 'Failed to complete Google sign-in. Please try again.',
  user_info: 'Could not retrieve your Google account information.',
  callback_error: 'An error occurred during sign-in. Please try again.',
  please_restart_the_process: 'Your session expired. Please try signing in again.',
};

// Get user-friendly error message for auth error code
export function getAuthErrorMessage(errorCode: string): string {
  return AUTH_ERROR_MESSAGES[errorCode] ?? `Authentication failed: ${errorCode.replace(/_/g, ' ')}`;
}
