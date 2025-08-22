-- Drop the monitoring_settings table as global monitoring is removed
-- Monitoring is now controlled per-account only

DROP TABLE IF EXISTS monitoring_settings;

-- Also remove any related indexes if they exist
DROP INDEX IF EXISTS idx_monitoring_settings_user_id;