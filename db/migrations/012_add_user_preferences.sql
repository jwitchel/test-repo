-- Add preferences column to user table for storing user-specific settings
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Add comment to explain the column
COMMENT ON COLUMN "user".preferences IS 'User-specific settings and preferences in JSON format';