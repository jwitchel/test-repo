-- Add image column to user table (required by better-auth for social providers)
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS image TEXT;