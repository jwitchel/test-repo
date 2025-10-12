-- Add indexes for dashboard analytics performance
-- These indexes optimize time-based queries for the actions chart and table

-- Index for time-based queries (DESC for recent-first ordering)
CREATE INDEX IF NOT EXISTS idx_email_action_tracking_updated_at
ON email_action_tracking(updated_at DESC);

-- Composite index for user + time queries with action filtering
CREATE INDEX IF NOT EXISTS idx_email_action_tracking_user_time
ON email_action_tracking(user_id, updated_at DESC, action_taken);

-- Index for efficient action type counting within time ranges
CREATE INDEX IF NOT EXISTS idx_email_action_tracking_time_action
ON email_action_tracking(updated_at DESC, action_taken)
WHERE action_taken != 'none';
