-- Make IMAP password nullable for OAuth accounts
ALTER TABLE email_accounts 
ALTER COLUMN imap_password_encrypted DROP NOT NULL;