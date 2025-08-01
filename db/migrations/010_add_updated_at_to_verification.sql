-- Add updatedAt column to verification table (required by better-auth)
ALTER TABLE verification 
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;