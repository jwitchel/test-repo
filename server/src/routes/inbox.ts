import express from 'express';
import { requireAuth } from '../middleware/auth';
import { ImapOperations } from '../lib/imap-operations';
import { pool } from '../server';

const router = express.Router();

// Get inbox emails for a specific account
router.get('/emails/:accountId', requireAuth, async (req, res): Promise<void> => {
  const startTime = Date.now();
  let imapOps: ImapOperations | null = null;
  
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.params;
    const { offset = 0, limit = 1 } = req.query;
    
    console.log(`[inbox] === START === offset: ${offset}, limit: ${limit}`);
    
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
    // Using getMessageRaw for faster loading (skips parsing attachments)
    const fullMessages = [];
    for (const msg of messages) {
      try {
        const fetchStart = Date.now();
        console.log(`Fetching full message for UID ${msg.uid}`);
        const fullMessage = await imapOps.getMessageRaw('INBOX', msg.uid);
        console.log(`Fetched UID ${msg.uid} in ${Date.now() - fetchStart}ms`);
        
        // Ensure we have a raw message
        const rawMessage = fullMessage.rawMessage || '';
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
    
    // Only get total count on first request (offset 0)
    // This avoids repeated expensive operations
    let totalCount = -1;
    if (Number(offset) === 0) {
      try {
        const folderStart = Date.now();
        console.log('Getting INBOX message count (first request only)...');
        const folderInfo = await imapOps.getFolderMessageCount('INBOX');
        totalCount = folderInfo.total;
        console.log(`Got INBOX count in ${Date.now() - folderStart}ms, total messages: ${totalCount}`);
      } catch (err) {
        console.error('Failed to get total count:', err);
        totalCount = -1; // Unknown total
      }
    }
    
    const response = {
      messages: fullMessages,
      total: totalCount,
      offset: Number(offset),
      limit: Number(limit)
    };
    
    const elapsed = Date.now() - startTime;
    console.log(`[inbox] === COMPLETE === ${elapsed}ms`);
    res.json(response);
    
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[inbox] === ERROR === ${elapsed}ms`, error);
    res.status(500).json({ 
      error: 'Failed to fetch inbox',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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