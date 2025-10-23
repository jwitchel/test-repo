-- Add sender email column to email_action_tracking table
ALTER TABLE email_action_tracking ADD COLUMN IF NOT EXISTS sender_email TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_action_tracking_sender ON email_action_tracking(sender_email);
