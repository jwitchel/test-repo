-- Seed data for bot_senders table
-- Generated from bot_senders_draft.csv
-- Only entries with specific email addresses (containing @) are useful for detection
-- Domain-only entries are stored as unconfirmed placeholders for admin research

-- Clear existing data for re-seeding
TRUNCATE TABLE bot_senders RESTART IDENTITY CASCADE;

-- Confirmed bot senders with specific email addresses
-- These are immediately usable for detection

-- American Airlines (confirmed)
INSERT INTO bot_senders (email_address, company_name, category, is_confirmed) VALUES
  ('no-reply@info.email.aa.com', 'American Airlines', 'airlines', true),
  ('noreply-mfa1@aa.com', 'American Airlines', 'airlines', true);

-- JPMorgan Chase (confirmed)
INSERT INTO bot_senders (email_address, company_name, category, is_confirmed) VALUES
  ('alerts.no.reply@jpmorgan.com', 'JPMorgan Chase', 'banks', true),
  ('esign@docusign.jpmorgan.com', 'JPMorgan Chase', 'banks', true);

-- PayPal (confirmed)
INSERT INTO bot_senders (email_address, company_name, category, is_confirmed) VALUES
  ('service@paypal.com', 'PayPal', 'payments', true);

-- Note: The CSV contains ~790 entries but most are domain placeholders (e.g., "delta.com")
-- These cannot be used for bot detection because they would match human employees
-- Admin can use the CRUD UI to research and add specific bot email addresses

-- Example domain placeholders (stored as unconfirmed for admin reference)
-- These are NOT used for detection until specific email addresses are added

INSERT INTO bot_senders (email_address, company_name, category, is_confirmed) VALUES
  -- Airlines (placeholders - need specific bot emails)
  ('noreply@delta.com', 'Delta Air Lines', 'airlines', false),
  ('noreply@united.com', 'United Airlines', 'airlines', false),
  ('noreply@southwest.com', 'Southwest Airlines', 'airlines', false),

  -- Banks (placeholders)
  ('noreply@bankofamerica.com', 'Bank of America', 'banks', false),
  ('noreply@wellsfargo.com', 'Wells Fargo', 'banks', false),
  ('noreply@citi.com', 'Citibank', 'banks', false),
  ('noreply@capitalone.com', 'Capital One', 'banks', false),

  -- E-commerce (placeholders)
  ('noreply@amazon.com', 'Amazon', 'ecommerce', false),
  ('noreply@ebay.com', 'eBay', 'ecommerce', false),
  ('noreply@walmart.com', 'Walmart', 'ecommerce', false),
  ('noreply@target.com', 'Target', 'ecommerce', false),

  -- Shipping (placeholders)
  ('noreply@fedex.com', 'FedEx', 'shipping_logistics', false),
  ('noreply@ups.com', 'UPS', 'shipping_logistics', false),
  ('noreply@usps.com', 'USPS', 'shipping_logistics', false),

  -- Payments (placeholders)
  ('noreply@venmo.com', 'Venmo', 'payments', false),
  ('noreply@zelle.com', 'Zelle', 'payments', false),
  ('noreply@cashapp.com', 'Cash App', 'payments', false),

  -- SaaS/Productivity (placeholders)
  ('noreply@zoom.us', 'Zoom', 'saas_productivity', false),
  ('noreply@slack.com', 'Slack', 'saas_productivity', false),
  ('noreply@microsoft.com', 'Microsoft 365', 'saas_productivity', false),
  ('noreply@google.com', 'Google Workspace', 'saas_productivity', false),
  ('noreply@dropbox.com', 'Dropbox', 'saas_productivity', false),
  ('noreply@docusign.com', 'DocuSign', 'saas_productivity', false),

  -- Streaming (placeholders)
  ('noreply@netflix.com', 'Netflix', 'streaming', false),
  ('noreply@spotify.com', 'Spotify', 'streaming', false),
  ('noreply@hulu.com', 'Hulu', 'streaming', false),

  -- Rideshare/Delivery (placeholders)
  ('noreply@uber.com', 'Uber', 'rideshare_delivery', false),
  ('noreply@lyft.com', 'Lyft', 'rideshare_delivery', false),
  ('noreply@doordash.com', 'DoorDash', 'rideshare_delivery', false),
  ('noreply@instacart.com', 'Instacart', 'rideshare_delivery', false),

  -- Travel/Hotels (placeholders)
  ('noreply@marriott.com', 'Marriott', 'travel_hotels', false),
  ('noreply@hilton.com', 'Hilton', 'travel_hotels', false),
  ('noreply@airbnb.com', 'Airbnb', 'travel_hotels', false),
  ('noreply@expedia.com', 'Expedia', 'travel_hotels', false),

  -- Social Media (placeholders)
  ('noreply@facebookmail.com', 'Facebook', 'social_media', false),
  ('noreply@linkedin.com', 'LinkedIn', 'social_media', false),
  ('noreply@twitter.com', 'Twitter/X', 'social_media', false),

  -- Developer Tools (placeholders)
  ('noreply@github.com', 'GitHub', 'developer_tools', false),
  ('noreply@vercel.com', 'Vercel', 'developer_tools', false),
  ('noreply@netlify.com', 'Netlify', 'developer_tools', false);

-- Summary: 5 confirmed + ~40 placeholder entries
-- Admin should use the CRUD UI to:
-- 1. Research actual bot email addresses for each company
-- 2. Update placeholders with confirmed addresses
-- 3. Add new companies as needed
