-- Add all missing columns that better-auth expects in the session table
ALTER TABLE session 
ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;

ALTER TABLE session 
ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- List current columns to verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'session' 
ORDER BY ordinal_position;