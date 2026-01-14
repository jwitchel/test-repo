-- Migration: 056_add_user_role.sql
-- Description: Add columns required by better-auth admin plugin

-- User table columns required by admin plugin
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT FALSE;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banReason" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banExpires" TIMESTAMPTZ;

-- Session table column for admin impersonation
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "impersonatedBy" TEXT;

-- Backfill existing users with NULL role (created before this migration)
UPDATE "user" SET role = 'user' WHERE role IS NULL;

-- Set admin role for jwitchel
UPDATE "user" SET role = 'admin' WHERE email = 'jwitchel@colevalleygroup.com';

-- Add index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_role ON "user" (role);
