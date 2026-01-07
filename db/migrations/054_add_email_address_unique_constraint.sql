-- Add unique constraint to email_accounts.email_address
-- Prevents multiple users from monitoring the same email address
-- which would cause duplicate processing and conflicts

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_accounts_email_address_unique'
  ) THEN
    ALTER TABLE email_accounts
    ADD CONSTRAINT email_accounts_email_address_unique
    UNIQUE (email_address);
  END IF;
END $$;
