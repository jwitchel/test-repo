-- Migration: 003_create_relationship_tables.sql
-- Description: Create people-based relationship management schema for tone profiles
-- Dependencies: user table must exist (from better-auth)

-- People (individuals who may have multiple email addresses)
CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Email addresses belonging to people
CREATE TABLE IF NOT EXISTS person_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  email_address VARCHAR(255) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(person_id, email_address)
);

-- User-defined relationship types
CREATE TABLE IF NOT EXISTS user_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_system_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, relationship_type)
);

-- Person to relationship mappings
CREATE TABLE IF NOT EXISTS person_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  user_set BOOLEAN DEFAULT FALSE,
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id, relationship_type) REFERENCES user_relationships(user_id, relationship_type),
  UNIQUE(user_id, person_id, relationship_type)
);

-- Ensure only one primary relationship per person
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_per_person 
ON person_relationships(user_id, person_id) 
WHERE is_primary = TRUE;

-- Tone preferences per relationship (simplified)
CREATE TABLE IF NOT EXISTS relationship_tone_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL,
  style_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id, relationship_type) REFERENCES user_relationships(user_id, relationship_type),
  UNIQUE(user_id, relationship_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_person_emails_person ON person_emails(person_id);
CREATE INDEX IF NOT EXISTS idx_person_relationships_user_person ON person_relationships(user_id, person_id);
CREATE INDEX IF NOT EXISTS idx_person_emails_email ON person_emails(email_address);
CREATE INDEX IF NOT EXISTS idx_people_user ON people(user_id);

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
DROP TRIGGER IF EXISTS update_people_updated_at ON people;
CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON people
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_relationships_updated_at ON user_relationships;
CREATE TRIGGER update_user_relationships_updated_at BEFORE UPDATE ON user_relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_person_relationships_updated_at ON person_relationships;
CREATE TRIGGER update_person_relationships_updated_at BEFORE UPDATE ON person_relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_relationship_tone_preferences_updated_at ON relationship_tone_preferences;
CREATE TRIGGER update_relationship_tone_preferences_updated_at BEFORE UPDATE ON relationship_tone_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();