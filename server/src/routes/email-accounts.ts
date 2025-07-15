import express from 'express';
import { requireAuth } from '../server';
import { pool } from '../server';
import { encryptPassword } from '../lib/crypto';
import { validateEmailAccount } from '../middleware/validation';
import { 
  CreateEmailAccountRequest, 
  EmailAccountResponse,
  ImapConnectionError 
} from '../types/email-account';

const router = express.Router();

// Mock IMAP connection test - will be implemented in Task 2.3
async function testImapConnection(config: CreateEmailAccountRequest): Promise<void> {
  // Simulate connection delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // For now, we'll mock the test using our test email server accounts
  // This will be replaced with actual IMAP testing in Task 2.3
  const testAccounts = [
    'user1@testmail.local',
    'user2@testmail.local',
    'user3@testmail.local'
  ];
  
  // Mock validation - accept test accounts and common email providers
  const isTestAccount = testAccounts.includes(config.email_address.toLowerCase());
  const isCommonProvider = ['gmail.com', 'outlook.com', 'yahoo.com'].some(domain => 
    config.email_address.toLowerCase().endsWith(domain)
  );
  
  if (!isTestAccount && !isCommonProvider) {
    // Simulate unknown host error for other domains
    throw new ImapConnectionError('Unknown host', 'ENOTFOUND');
  }
  
  // Simulate auth failure for test accounts with wrong password
  if (isTestAccount && config.imap_password !== 'testpass123') {
    throw new ImapConnectionError('Authentication failed', 'AUTHENTICATIONFAILED');
  }
  
  // Connection successful
  console.log(`IMAP connection test passed for ${config.email_address}`);
}

// Get user's email accounts
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    const result = await pool.query(
      `SELECT id, email_address, imap_host, imap_port, imap_username, 
              is_active, last_sync, created_at 
       FROM email_accounts 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    
    const accounts: EmailAccountResponse[] = result.rows.map(row => ({
      id: row.id,
      email_address: row.email_address,
      imap_host: row.imap_host,
      imap_port: row.imap_port,
      imap_secure: row.imap_port === 993 || row.imap_port === 1993, // Infer from port
      imap_username: row.imap_username,
      is_active: row.is_active,
      last_sync: row.last_sync ? row.last_sync.toISOString() : null,
      created_at: row.created_at.toISOString(),
      updated_at: row.created_at.toISOString() // Use created_at as fallback
    }));
    
    res.json(accounts);
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    res.status(500).json({ error: 'Failed to fetch email accounts' });
  }
});

// Add new email account
router.post('/', requireAuth, validateEmailAccount, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const accountData = req.body as CreateEmailAccountRequest;
    
    // Check if email account already exists for this user
    const existing = await pool.query(
      'SELECT id FROM email_accounts WHERE user_id = $1 AND email_address = $2',
      [userId, accountData.email_address]
    );
    
    if (existing.rows.length > 0) {
      res.status(409).json({ 
        error: 'Email account already exists',
        field: 'email_address'
      });
      return;
    }
    
    // Test IMAP connection (mocked for now)
    try {
      await testImapConnection(accountData);
    } catch (error) {
      if (error instanceof ImapConnectionError) {
        if (error.code === 'AUTHENTICATIONFAILED') {
          res.status(401).json({ 
            error: 'IMAP authentication failed',
            message: 'Invalid email credentials'
          });
          return;
        } else if (error.code === 'ENOTFOUND') {
          res.status(400).json({ 
            error: 'IMAP connection failed',
            message: 'Unable to connect to IMAP server'
          });
          return;
        }
      }
      
      res.status(408).json({ 
        error: 'IMAP connection timeout',
        message: 'Connection to email server timed out'
      });
      return;
    }
    
    // Encrypt password
    const encryptedPassword = encryptPassword(accountData.imap_password);
    
    // Insert into database
    const result = await pool.query(
      `INSERT INTO email_accounts 
       (user_id, email_address, imap_host, imap_port, imap_username, imap_password_encrypted, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, email_address, imap_host, imap_port, imap_username, is_active, last_sync, created_at`,
      [
        userId, 
        accountData.email_address, 
        accountData.imap_host, 
        accountData.imap_port,
        accountData.imap_username, 
        encryptedPassword,
        true // Set as active by default
      ]
    );
    
    const account: EmailAccountResponse = {
      id: result.rows[0].id,
      email_address: result.rows[0].email_address,
      imap_host: result.rows[0].imap_host,
      imap_port: result.rows[0].imap_port,
      imap_secure: accountData.imap_secure, // Not stored in DB, return from request
      imap_username: result.rows[0].imap_username,
      is_active: result.rows[0].is_active,
      last_sync: result.rows[0].last_sync ? result.rows[0].last_sync.toISOString() : null,
      created_at: result.rows[0].created_at.toISOString(),
      updated_at: new Date().toISOString() // Not in DB, use current time
    };
    
    res.status(201).json(account);
  } catch (error) {
    console.error('Error creating email account:', error);
    res.status(500).json({ error: 'Failed to create email account' });
  }
});

// Delete email account
router.delete('/:id', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const accountId = req.params.id;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(accountId)) {
      res.status(400).json({ error: 'Invalid account ID format' });
      return;
    }
    
    const result = await pool.query(
      'DELETE FROM email_accounts WHERE id = $1 AND user_id = $2 RETURNING id',
      [accountId, userId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Email account not found' });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting email account:', error);
    res.status(500).json({ error: 'Failed to delete email account' });
  }
});

export default router;