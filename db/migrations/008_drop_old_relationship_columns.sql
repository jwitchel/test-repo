-- Migration: 008_drop_old_relationship_columns.sql
-- Description: Drop old relationship_type columns after successful migration to FK-based structure
-- Date: 2025-07-29

-- Step 1: Drop the old foreign key constraint on person_relationships
ALTER TABLE person_relationships 
DROP CONSTRAINT IF EXISTS person_relationships_user_id_relationship_type_fkey;

-- Step 2: Drop the old unique constraint
ALTER TABLE person_relationships 
DROP CONSTRAINT IF EXISTS person_relationships_user_id_person_id_relationship_type_key;

-- Step 3: Drop the relationship_type column from person_relationships
ALTER TABLE person_relationships 
DROP COLUMN relationship_type;

-- Step 4: Add new unique constraint using user_relationship_id
ALTER TABLE person_relationships 
ADD CONSTRAINT person_relationships_user_id_person_id_user_relationship_id_key 
UNIQUE (user_id, person_id, user_relationship_id);

-- Note: We keep target_identifier in tone_preferences as it's still needed for:
-- - 'aggregate' preference type (no relationship)
-- - Future 'individual' preference types (email or person_id)