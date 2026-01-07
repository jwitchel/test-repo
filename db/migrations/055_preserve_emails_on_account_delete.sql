-- Migration: Change email_account_id CASCADE to SET NULL
-- Problem: Deleting an email account destroys all training data (email_sent vectors,
-- email_received history, draft_tracking context). This data belongs to the USER,
-- not the account - user_id is the true owner.
--
-- Solution: Change ON DELETE CASCADE to ON DELETE SET NULL for email_account_id
-- This preserves all emails and training data when an account is disconnected.

-- Step 1: Make email_account_id nullable (required for SET NULL)
ALTER TABLE email_sent ALTER COLUMN email_account_id DROP NOT NULL;
ALTER TABLE email_received ALTER COLUMN email_account_id DROP NOT NULL;
ALTER TABLE draft_tracking ALTER COLUMN email_account_id DROP NOT NULL;

-- Step 2: Drop existing CASCADE constraints and recreate with SET NULL
-- email_sent
ALTER TABLE email_sent DROP CONSTRAINT IF EXISTS email_sent_email_account_id_fkey;
ALTER TABLE email_sent ADD CONSTRAINT email_sent_email_account_id_fkey
    FOREIGN KEY (email_account_id) REFERENCES email_accounts(id) ON DELETE SET NULL;

-- email_received
ALTER TABLE email_received DROP CONSTRAINT IF EXISTS email_received_email_account_id_fkey;
ALTER TABLE email_received ADD CONSTRAINT email_received_email_account_id_fkey
    FOREIGN KEY (email_account_id) REFERENCES email_accounts(id) ON DELETE SET NULL;

-- draft_tracking
ALTER TABLE draft_tracking DROP CONSTRAINT IF EXISTS draft_tracking_email_account_id_fkey;
ALTER TABLE draft_tracking ADD CONSTRAINT draft_tracking_email_account_id_fkey
    FOREIGN KEY (email_account_id) REFERENCES email_accounts(id) ON DELETE SET NULL;
