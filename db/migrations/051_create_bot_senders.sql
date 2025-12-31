-- Migration: Create bot_senders table for known automated email senders
-- Global system table of known bot/automated email senders
-- Companies often have multiple bot addresses (e.g., AA has no-reply@info.email.aa.com, noreply-mfa1@aa.com)

CREATE TABLE IF NOT EXISTS bot_senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_address VARCHAR(255) NOT NULL UNIQUE,  -- Specific email (not domain)
  company_name VARCHAR(255) NOT NULL,          -- For display/grouping
  category VARCHAR(100) NOT NULL,              -- e.g., 'airlines', 'banks', 'ecommerce'
  is_confirmed BOOLEAN DEFAULT false,          -- true = verified bot address, false = placeholder/needs research
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookup during email processing (primary detection path)
CREATE INDEX IF NOT EXISTS idx_bot_senders_email ON bot_senders(email_address);

-- Index for admin UI filtering by category
CREATE INDEX IF NOT EXISTS idx_bot_senders_category ON bot_senders(category);

-- Index for detection queries (only confirmed senders are used)
CREATE INDEX IF NOT EXISTS idx_bot_senders_confirmed ON bot_senders(is_confirmed) WHERE is_confirmed = true;

COMMENT ON TABLE bot_senders IS 'Global system table of known bot/automated email senders for deterministic detection';
COMMENT ON COLUMN bot_senders.email_address IS 'Specific email address (not domain) - domains cannot be used as they match human employees';
COMMENT ON COLUMN bot_senders.is_confirmed IS 'Only confirmed=true entries are used for bot detection; false entries are placeholders for admin research';
