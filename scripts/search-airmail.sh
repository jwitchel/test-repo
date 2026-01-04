#!/bin/bash
# Search Airmail local database for emails from a domain
# Returns unique sender email addresses
# Usage: ./search-airmail.sh <domain>
# Example: ./search-airmail.sh jetblue.com

DOMAIN="$1"
if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <domain>"
  echo "Example: $0 jetblue.com"
  exit 1
fi

# Convert domain to hex for blob search (lowercase)
DOMAIN_LOWER=$(echo "$DOMAIN" | tr '[:upper:]' '[:lower:]')
DOMAIN_HEX=$(echo -n "$DOMAIN_LOWER" | xxd -p)

AIRMAIL_BASE="$HOME/Library/Group Containers/2E337YPCZY.airmail/Library/Application Support/it.bloop.airmail2/Airmail"

# Extract unique sender emails from bplist blobs (case-insensitive, exact domain match)
for db in "$AIRMAIL_BASE"/*/Message/Message_*.db; do
  sqlite3 "$db" "SELECT hex(senderAddr) FROM Message WHERE hex(lower(senderAddr)) LIKE '%${DOMAIN_HEX}%'" 2>/dev/null | while read hex; do
    echo "$hex" | xxd -r -p | LC_ALL=C strings | grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' | grep -iE "@([a-z0-9.-]+\.)?${DOMAIN}$"
  done
done 2>/dev/null | tr '[:upper:]' '[:lower:]' | LC_ALL=C sort -u
