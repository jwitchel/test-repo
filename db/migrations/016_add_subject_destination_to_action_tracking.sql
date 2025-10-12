-- Add subject and destination folder to email_action_tracking
-- This allows the dashboard to display meaningful information without querying Qdrant

ALTER TABLE email_action_tracking
ADD COLUMN IF NOT EXISTS subject TEXT,
ADD COLUMN IF NOT EXISTS destination_folder TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_action_tracking_subject
ON email_action_tracking(subject);
