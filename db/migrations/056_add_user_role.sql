-- Migration: 056_add_user_role.sql
-- Description: Add role column for RBAC support via better-auth admin plugin

-- Add role column to user table (better-auth admin plugin requirement)
-- Default to 'user' for all existing and new users
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Backfill existing users with NULL role (created before this migration)
UPDATE "user" SET role = 'user' WHERE role IS NULL;

-- Set admin role for jwitchel
UPDATE "user" SET role = 'admin' WHERE email = 'jwitchel@colevalleygroup.com';

-- Add index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_role ON "user" (role);
