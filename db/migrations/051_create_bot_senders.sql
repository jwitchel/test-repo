-- Migration: Create bot_senders table for known automated email senders
-- Global system table of known bot/automated email senders
-- Uses regex patterns with domain-based filtering for O(1) lookup

CREATE TABLE IF NOT EXISTS bot_senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_pattern VARCHAR(255) NOT NULL UNIQUE,  -- Regex pattern (e.g., .*@.*\.amazon.com)
  domain VARCHAR(255) NOT NULL,                -- Root domain for fast filtering
  company_name VARCHAR(255) NOT NULL,          -- For display/grouping
  category VARCHAR(100) NOT NULL,              -- e.g., 'airlines', 'banks', 'ecommerce'
  is_confirmed BOOLEAN DEFAULT false,          -- true = verified bot, false = placeholder
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for admin UI filtering by category
CREATE INDEX IF NOT EXISTS idx_bot_senders_category ON bot_senders(category);

-- Index for detection queries (domain + confirmed)
CREATE INDEX IF NOT EXISTS idx_bot_senders_domain ON bot_senders(domain);
CREATE INDEX IF NOT EXISTS idx_bot_senders_confirmed ON bot_senders(is_confirmed) WHERE is_confirmed = true;

COMMENT ON TABLE bot_senders IS 'Global system table of known bot/automated email senders for deterministic detection';
COMMENT ON COLUMN bot_senders.email_pattern IS 'Regex pattern - can be exact (foo@bar.com) or wildcard (.*@.*\.bar.com)';
COMMENT ON COLUMN bot_senders.domain IS 'Root domain for fast filtering during detection (queries only patterns for matching domain)';
COMMENT ON COLUMN bot_senders.is_confirmed IS 'Only confirmed=true entries are used for bot detection; false entries are placeholders';
