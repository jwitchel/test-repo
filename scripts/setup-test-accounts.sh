#!/bin/bash
# scripts/setup-test-accounts.sh

# Wait for mailserver to be ready
echo "Waiting for mailserver to be ready..."
sleep 10

# Create test accounts
echo "Creating test email accounts..."
docker exec test-mailserver setup email add user1@testmail.local testpass123
docker exec test-mailserver setup email add user2@testmail.local testpass123
docker exec test-mailserver setup email add user3@testmail.local testpass123

# Create IMAP folders
echo "Creating IMAP folders..."
docker exec test-mailserver doveadm mailbox create -u user1@testmail.local "INBOX.AI-Ready"
docker exec test-mailserver doveadm mailbox create -u user2@testmail.local "INBOX.AI-Ready"

echo "Test accounts setup complete!"