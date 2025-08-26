import express from 'express';
import { requireAuth } from '../middleware/auth';
import { ImapSession } from '../lib/imap-session';
import { ImapConnectionError } from '../lib/imap-connection';
import { withImapContext } from '../lib/imap-context';
import { pool } from '../server';
import { imapPool } from '../lib/imap-pool';

const router = express.Router();

// Get inbox emails for a specific account
router.get('/emails/:accountId', requireAuth, async (req, res): Promise<void> => {
  const startTime = Date.now();
  let imapSession: ImapSession | null = null;
  
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
    
    // Results captured outside the context for response
    let messages: any[] = [];
    let fullMessages: any[] = [];
    let totalCount = -1;
    let operationCount = 0;

    await withImapContext(accountId, userId, async () => {
      // Initialize IMAP session - maintains single connection for all operations
      imapSession = await ImapSession.fromAccountId(accountId, userId);

      console.log(`Fetching messages for account ${accountId}, offset: ${offset}, limit: ${limit}`);

      // Get messages from INBOX - connection preserved
      messages = await imapSession!.getMessages('INBOX', {
        offset: Number(offset),
        limit: Number(limit),
        descending: true // Newest first
      });

      console.log(`Found ${messages.length} messages`);

      const uids = messages.map(msg => msg.uid);
      if (uids.length > 0) {
        const batchStart = Date.now();
        console.log(`Batch fetching ${uids.length} messages...`);
        try {
          const batchedMessages = await imapSession!.getMessagesRaw('INBOX', uids);
          console.log(`Batch fetched ${batchedMessages.length} messages in ${Date.now() - batchStart}ms`);
          fullMessages = batchedMessages.map(msg => ({
            uid: msg.uid,
            messageId: msg.messageId || `${msg.uid}@${accountId}`,
            from: msg.from || 'Unknown',
            to: msg.to || [],
            subject: msg.subject || '(No subject)',
            date: msg.date || new Date(),
            flags: msg.flags || [],
            size: msg.size || 0,
            rawMessage: msg.rawMessage || ''
          }));
        } catch (err) {
          console.error('Batch fetch failed, falling back to individual fetches:', err);
          for (const msg of messages) {
            try {
              const fullMessage = await imapSession!.getMessageRaw('INBOX', msg.uid);
              fullMessages.push({
                uid: fullMessage.uid,
                messageId: fullMessage.messageId || `${msg.uid}@${accountId}`,
                from: fullMessage.from || 'Unknown',
                to: fullMessage.to || [],
                subject: fullMessage.subject || '(No subject)',
                date: fullMessage.date || new Date(),
                flags: fullMessage.flags || [],
                size: fullMessage.size || 0,
                rawMessage: fullMessage.rawMessage || ''
              });
            } catch (err) {
              console.error(`Failed to fetch message ${msg.uid}:`, err);
            }
          }
        }
      }

      // Only get total count on first request (offset 0)
      if (Number(offset) === 0) {
        try {
          const folderStart = Date.now();
          console.log('Getting INBOX message count (first request only)...');
          const folderInfo = await imapSession!.getFolderMessageCount('INBOX');
          totalCount = folderInfo.total;
          console.log(`Got INBOX count in ${Date.now() - folderStart}ms, total messages: ${totalCount}`);
        } catch (err) {
          console.error('Failed to get total count:', err);
          totalCount = -1; // Unknown total
        }
      }

      // Track operation count for headers
      operationCount = imapSession!.getMetrics().operationCount;
    });

    const response = {
      messages: fullMessages,
      total: totalCount,
      offset: Number(offset),
      limit: Number(limit)
    };

    // Log session statistics before closing
    console.log(`[inbox] Session performed ${operationCount} operations on single connection`);
    
    // Log pool statistics
    const poolStats = imapPool.getPoolStats();
    console.log(`[inbox] Pool stats: ${poolStats.totalConnections} total, ${poolStats.activeConnections} active, ${poolStats.pooledAccounts} accounts`);
    
    const elapsed = Date.now() - startTime;
    console.log(`[inbox] === COMPLETE === ${elapsed}ms`);
    
    // Include performance info in response headers
    res.set({
      'X-IMAP-Operations': String(operationCount),
      'X-IMAP-Duration': String(elapsed),
      'X-IMAP-Pool-Total': String(poolStats.totalConnections),
      'X-IMAP-Pool-Active': String(poolStats.activeConnections)
    });

    res.json(response);
    
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[inbox] === ERROR === ${elapsed}ms`, error);
    // Map OAuth refresh failures to 401 so client can prompt re-auth
    if (error instanceof ImapConnectionError && error.code === 'AUTH_REFRESH_FAILED') {
      res.status(401).json({
        error: 'OAUTH_REAUTH_REQUIRED',
        message: 'Email provider session expired or revoked. Please reconnect your account.'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch inbox',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } finally {
    // Connection is managed by withImapContext; no manual close needed here
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
