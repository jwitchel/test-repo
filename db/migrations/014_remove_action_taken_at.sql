-- Remove redundant action_taken_at column since updated_at serves the same purpose
ALTER TABLE email_action_tracking 
DROP COLUMN IF EXISTS action_taken_at;