-- Create email_action_tracking table to track which emails have been processed
-- Since emails are fetched from IMAP and not stored permanently, 
-- we need a separate table to track action status

CREATE TABLE IF NOT EXISTS email_action_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL,
    action_taken VARCHAR(50) DEFAULT 'none',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(email_account_id, message_id)
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_email_action_tracking_account_message 
ON email_action_tracking(email_account_id, message_id);

CREATE INDEX IF NOT EXISTS idx_email_action_tracking_action 
ON email_action_tracking(action_taken);

-- Add index for user queries
CREATE INDEX IF NOT EXISTS idx_email_action_tracking_user 
ON email_action_tracking(user_id);