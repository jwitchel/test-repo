-- Consolidate subdomain patterns into wildcard patterns
-- Example: aws-receivables-support@email.amazon.com → .*@.*\.amazon.com
-- Keep root domain exact patterns intact (no-reply@amazon.com)

-- Step 1: Create temp table with subdomain patterns to consolidate
-- Extract root domain using reverse split approach for correctness
CREATE TEMP TABLE subdomain_patterns AS
WITH domain_parts AS (
  SELECT
    id,
    company_name,
    category,
    domain,
    string_to_array(domain, '.') AS parts
  FROM bot_senders
  WHERE is_confirmed = true
)
SELECT DISTINCT
  company_name,
  category,
  -- Root domain = last two parts joined by dot
  parts[array_length(parts, 1) - 1] || '.' || parts[array_length(parts, 1)] AS root_domain
FROM domain_parts
WHERE array_length(parts, 1) >= 3;  -- Has 3+ parts (is a subdomain)

-- Step 2: Delete subdomain exact patterns (will be replaced by wildcard)
DELETE FROM bot_senders
WHERE is_confirmed = true
  AND array_length(string_to_array(domain, '.'), 1) >= 3;

-- Step 3: Insert wildcard patterns for each root domain
INSERT INTO bot_senders (email_pattern, domain, company_name, category, is_confirmed)
SELECT DISTINCT
  '.*@.*\.' || root_domain AS email_pattern,  -- e.g., .*@.*\.amazon.com
  root_domain AS domain,                       -- e.g., amazon.com (for lookup)
  company_name,
  category,
  true AS is_confirmed
FROM subdomain_patterns
ON CONFLICT (email_pattern) DO NOTHING;  -- Skip if already exists

-- Clean up
DROP TABLE subdomain_patterns;

-- Log the changes
DO $$
DECLARE
  wildcard_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO wildcard_count
  FROM bot_senders
  WHERE email_pattern LIKE '.*@.*\.%';

  RAISE NOTICE 'Created % wildcard subdomain patterns', wildcard_count;
END $$;
