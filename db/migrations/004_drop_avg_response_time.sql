-- Migration: 004_drop_avg_response_time.sql
-- Description: Remove unused avg_response_time_hours column from relationship_tone_preferences
-- Date: 2025-07-29

-- Drop the avg_response_time_hours column
ALTER TABLE relationship_tone_preferences 
DROP COLUMN IF EXISTS avg_response_time_hours;