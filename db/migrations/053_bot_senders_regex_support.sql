-- Add regex pattern support to bot_senders table
-- Rename email_address to email_pattern (all patterns are valid regex)
-- Add domain column for fast filtering (only test patterns for matching domain)

-- Rename column
ALTER TABLE bot_senders RENAME COLUMN email_address TO email_pattern;

-- Add domain column
ALTER TABLE bot_senders ADD COLUMN domain VARCHAR(255);

-- Populate domain from existing patterns (extract part after @)
UPDATE bot_senders SET domain = split_part(email_pattern, '@', 2);

-- Make domain NOT NULL going forward
ALTER TABLE bot_senders ALTER COLUMN domain SET NOT NULL;

-- Add index on domain for fast filtering during detection
CREATE INDEX idx_bot_senders_domain ON bot_senders(domain);

-- Drop the old unique constraint on email_pattern (was email_address)
-- and recreate it to update the constraint name
ALTER TABLE bot_senders DROP CONSTRAINT IF EXISTS bot_senders_email_address_key;
ALTER TABLE bot_senders ADD CONSTRAINT bot_senders_email_pattern_key UNIQUE (email_pattern);
