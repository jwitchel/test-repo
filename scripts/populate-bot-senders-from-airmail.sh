#!/bin/bash
# Populate bot_senders table from Airmail local email database
# For each placeholder domain record, searches Airmail for actual sender emails
# Replaces placeholder with confirmed email records

set -e

AIRMAIL_BASE="$HOME/Library/Group Containers/2E337YPCZY.airmail/Library/Application Support/it.bloop.airmail2/Airmail"
DB_HOST="localhost"
DB_PORT="5434"
DB_NAME="aiemaildb"
DB_USER="aiemailuser"
DB_PASS="aiemailpass"

# Function to search Airmail for emails from a domain (exact domain match)
search_airmail() {
  local domain="$1"
  local domain_lower=$(echo "$domain" | tr '[:upper:]' '[:lower:]')
  local domain_hex=$(echo -n "$domain_lower" | xxd -p)

  for db in "$AIRMAIL_BASE"/*/Message/Message_*.db; do
    sqlite3 "$db" "SELECT hex(senderAddr) FROM Message WHERE hex(lower(senderAddr)) LIKE '%${domain_hex}%'" 2>/dev/null | while read hex; do
      echo "$hex" | xxd -r -p | LC_ALL=C strings | grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' | grep -iE "@([a-z0-9.-]+\.)?${domain}$"
    done
  done 2>/dev/null | tr '[:upper:]' '[:lower:]' | LC_ALL=C sort -u
}

# Get all placeholder records (domain-only entries that are not confirmed)
echo "Fetching placeholder records from bot_senders..."
placeholders=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -A -F'|' -c "
  SELECT id, email_address, company_name, category
  FROM bot_senders
  WHERE is_confirmed = false
    AND email_address NOT LIKE '%@%'
  ORDER BY category, company_name
")

if [ -z "$placeholders" ]; then
  echo "No placeholder records found."
  exit 0
fi

total=$(echo "$placeholders" | wc -l | tr -d ' ')
echo "Found $total placeholder records to process."
echo ""

processed=0
replaced=0
skipped=0

echo "$placeholders" | while IFS='|' read -r id email_address company_name category; do
  processed=$((processed + 1))
  echo "[$processed/$total] Searching for: $email_address ($company_name)"

  # Search Airmail for matching emails
  emails=$(search_airmail "$email_address")

  if [ -n "$emails" ]; then
    email_count=$(echo "$emails" | wc -l | tr -d ' ')
    echo "  Found $email_count email(s):"
    echo "$emails" | sed 's/^/    /'

    # Delete the placeholder
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -q -c "
      DELETE FROM bot_senders WHERE id = '$id'
    "

    # Insert each found email as confirmed
    echo "$emails" | while read -r sender_email; do
      # Escape single quotes in company name
      escaped_company=$(echo "$company_name" | sed "s/'/''/g")

      # Insert (ignore duplicates)
      PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -q -c "
        INSERT INTO bot_senders (email_address, company_name, category, is_confirmed)
        VALUES ('$sender_email', '$escaped_company', '$category', true)
        ON CONFLICT (email_address) DO UPDATE SET is_confirmed = true
      " 2>/dev/null || true
    done

    echo "  ✓ Replaced placeholder with $email_count confirmed record(s)"
    replaced=$((replaced + 1))
  else
    echo "  No emails found in Airmail, keeping placeholder"
    skipped=$((skipped + 1))
  fi
  echo ""
done

echo "========================================="
echo "Done!"
echo "Processed: $total placeholders"
