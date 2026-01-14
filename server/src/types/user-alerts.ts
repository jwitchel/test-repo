/**
 * User Alerts Types
 *
 * Shared types for the persistent alert system.
 * Used by both backend services and frontend components.
 */

/**
 * Alert type constants - define once, use everywhere
 */
export const AlertType = {
  // Error types
  REAUTH_REQUIRED: 'reauth_required',
  CONNECTION_FAILED: 'connection_failed',
  INVALID_CREDENTIALS: 'invalid_credentials',
  RATE_LIMIT: 'rate_limit',
  QUOTA_EXCEEDED: 'quota_exceeded',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  DEFAULT_LLM_NOT_SET: 'default_llm_not_set',
  // Onboarding setup tasks
  SETUP_LLM_PROVIDER: 'setup_llm_provider',
  SETUP_EMAIL_ACCOUNT: 'setup_email_account',
  SETUP_FOLDERS: 'setup_folders',
  SETUP_PROFILE: 'setup_profile',
  SETUP_RELATIONSHIPS: 'setup_relationships',
  SETUP_TRAINING: 'setup_training',
} as const;

export type AlertType = (typeof AlertType)[keyof typeof AlertType];

/**
 * Alert severity constants
 */
export const AlertSeverity = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

/**
 * Source type constants - extend when adding new integrations
 */
export const SourceType = {
  EMAIL_ACCOUNT: 'email_account',
  LLM_PROVIDER: 'llm_provider',
  ONBOARDING: 'onboarding',
} as const;

export type SourceType = (typeof SourceType)[keyof typeof SourceType];

/**
 * Threshold for considering an error persistent (not transient)
 */
export const PERSISTENT_ERROR_THRESHOLD = 3;

/**
 * Source IDs for system-level alerts (not tied to specific entity UUIDs)
 */
export const AlertSourceId = {
  DEFAULT_LLM: 'default-llm',
} as const;

/**
 * Source IDs for onboarding setup alerts
 */
export const OnboardingSourceId = {
  LLM_PROVIDER: 'setup-llm-provider',
  EMAIL_ACCOUNT: 'setup-email-account',
  FOLDERS: 'setup-folders',
  PROFILE: 'setup-profile',
  RELATIONSHIPS: 'setup-relationships',
  TRAINING: 'setup-training',
} as const;

/**
 * Parameters for creating an alert
 */
export interface CreateAlertParams {
  userId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  sourceType: SourceType;
  sourceId: string;
  sourceName: string;
  message: string;
  actionUrl: string;
  actionLabel: string;
}

/**
 * Alert data returned by the API
 */
export interface UserAlert {
  id: string;
  alertType: AlertType;
  severity: AlertSeverity;
  sourceType: SourceType;
  sourceId: string;
  sourceName: string;
  message: string;
  actionUrl: string;
  actionLabel: string;
  errorCount: number;
  lastOccurredAt: string;
  createdAt: string;
}

/**
 * API response for alerts endpoint
 */
export interface UserAlertsResponse {
  alerts: UserAlert[];
}
