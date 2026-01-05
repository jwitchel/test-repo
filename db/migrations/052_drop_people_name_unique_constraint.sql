-- Drop the unique constraint on (user_id, name) in people table
-- Multiple people can have the same name (e.g., two "John Smith" contacts)
-- Uniqueness is enforced via person_emails.email_address instead

ALTER TABLE people DROP CONSTRAINT IF EXISTS people_user_id_name_key;
