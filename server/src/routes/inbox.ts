import express from 'express';
import { requireAuth } from '../middleware/auth';
import { ImapOperations } from '../lib/imap-operations';
import { pool } from '../server';

const router = express.Router();

// Get inbox emails for a specific account
router.get('/emails/:accountId', requireAuth, async (req, res): Promise<void> => {
  let imapOps: ImapOperations | null = null;
  
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.params;
    const { offset = 0, limit = 1 } = req.query;
    
    // Validate account belongs to user
    const accountCheck = await pool.query(
      'SELECT id FROM email_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );
    
    if (accountCheck.rows.length === 0) {
      res.status(404).json({ error: 'Email account not found' });
      return;
    }
    
    // Initialize IMAP operations
    imapOps = await ImapOperations.fromAccountId(accountId, userId);
    
    console.log(`Fetching messages for account ${accountId}, offset: ${offset}, limit: ${limit}`);
    
    // Get messages from INBOX
    const messages = await imapOps.getMessages('INBOX', {
      offset: Number(offset),
      limit: Number(limit),
      descending: true // Newest first
    });
    
    console.log(`Found ${messages.length} messages`);
    
    // For each message, get the full content including raw message
    const fullMessages = [];
    for (const msg of messages) {
      try {
        console.log(`Fetching full message for UID ${msg.uid}`);
        const fullMessage = await imapOps.getMessage('INBOX', msg.uid);
        
        // Ensure we have a raw message
        const rawMessage = fullMessage.rawMessage || fullMessage.body || '';
        if (!rawMessage) {
          console.warn(`No raw message content for UID ${msg.uid}`);
        }
        
        fullMessages.push({
          uid: fullMessage.uid,
          messageId: fullMessage.messageId || `${msg.uid}@${accountId}`,
          from: fullMessage.from || 'Unknown',
          to: fullMessage.to || [],
          subject: fullMessage.subject || '(No subject)',
          date: fullMessage.date || new Date(),
          flags: fullMessage.flags || [],
          size: fullMessage.size || 0,
          rawMessage: rawMessage
        });
      } catch (err) {
        console.error(`Failed to fetch message ${msg.uid}:`, err);
      }
    }
    
    // Get total count by searching with no limit
    let totalCount = 0;
    try {
      // Get folder info to get total message count
      const folders = await imapOps.getFolders();
      const inboxFolder = folders.find(f => f.name === 'INBOX' || f.path === 'INBOX');
      totalCount = inboxFolder?.messageCount || 0;
    } catch (err) {
      console.error('Failed to get total count:', err);
      totalCount = fullMessages.length; // Fallback to current messages length
    }
    
    res.json({
      messages: fullMessages,
      total: totalCount,
      offset: Number(offset),
      limit: Number(limit)
    });
    
  } catch (error) {
    console.error('Error fetching inbox:', error);
    res.status(500).json({ 
      error: 'Failed to fetch inbox',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    if (imapOps) {
      imapOps.release();
    }
  }
});

// Get user's email accounts
router.get('/accounts', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    
    const result = await pool.query(
      'SELECT id, email_address, imap_host FROM email_accounts WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    res.json({
      accounts: result.rows.map(row => ({
        id: row.id,
        email: row.email_address,
        host: row.imap_host
      }))
    });
    
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch email accounts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;