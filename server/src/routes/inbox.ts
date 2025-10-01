import express from 'express';
import { requireAuth } from '../middleware/auth';
import { withImapJson } from '../lib/http/imap-utils';
import { pool } from '../server';
import { EmailActionTracker } from '../lib/email-action-tracker';
import { inboxProcessor } from '../lib/email-processing/inbox-processor';
import { ImapOperations } from '../lib/imap-operations';

const router = express.Router();

// Process a single inbox email (used by UI)
router.post('/process-single', requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).user.id;
  const {
    emailAccountId,
    messageUid,
    messageId,
    messageSubject,
    messageFrom,
    rawMessage,
    providerId,
    dryRun,
    generatedDraft
  } = req.body;

  // Validate required fields
  if (!emailAccountId || !rawMessage || !providerId || !messageUid || dryRun === undefined) {
    res.status(400).json({
      error: 'Missing required fields: emailAccountId, rawMessage, providerId, messageUid, dryRun'
    });
    return;
  }

  try {
    // Use InboxProcessor to handle single email
    const result = await inboxProcessor.processEmail({
      message: {
        uid: messageUid,
        messageId,
        subject: messageSubject,
        from: messageFrom,
        rawMessage
      },
      accountId: emailAccountId,
      userId,
      providerId,
      dryRun,
      generatedDraft
    });

    if (result.success) {
      res.json({
        success: true,
        folder: result.destination,
        message: result.actionDescription,
        action: result.action,
        draftId: result.draftId
      });
    } else {
      res.status(500).json({
        error: 'Failed to process email',
        message: result.error
      });
    }
  } catch (error) {
    console.error('[inbox-process-single] Error:', error);
    res.status(500).json({
      error: 'Failed to process email',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get inbox emails for a specific account
router.get('/emails/:accountId', requireAuth, async (req, res): Promise<void> => {
  const startTime = Date.now();
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.params;
    const { offset = 0, limit = 1, showAll = 'false' } = req.query;

    console.log(`[inbox] === START === offset: ${offset}, limit: ${limit}, showAll: ${showAll}`);

    await withImapJson(res, accountId, userId, async () => {
      // Account validation happens in ImapOperations.fromAccountId()
      const imapOps = await ImapOperations.fromAccountId(accountId, userId);

      const targetOffset = Number(offset);
      const targetLimit = Number(limit);
      const BATCH_SIZE = parseInt(process.env.INBOX_BATCH_SIZE || '10', 10);
      let totalCount = -1;

      console.log(`Fetching ${BATCH_SIZE} messages from IMAP starting at offset 0`);
      const messages = await imapOps.getMessages('INBOX', {
        offset: 0,
        limit: BATCH_SIZE,
        descending: true
      });

      // Get full message details for all messages in batch
      let fullMessages: any[] = [];
      if (messages.length > 0) {
        const uids = messages.map(msg => msg.uid);
        const batched = await imapOps.getMessagesRaw('INBOX', uids);
        fullMessages = batched.map(msg => ({
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
      }

      // Get action tracking data for ALL messages in one query
      const messageIds = fullMessages.map(msg => msg.messageId).filter(id => id);
      const actionTrackingMap = await EmailActionTracker.getActionsForMessages(accountId, messageIds);

      // Enrich all messages with action tracking data
      const enrichedMessages = fullMessages.map(msg => ({
        ...msg,
        actionTaken: actionTrackingMap[msg.messageId]?.actionTaken || 'none',
        updatedAt: actionTrackingMap[msg.messageId]?.updatedAt
      }));

      // Get total count on first request
      if (Number(offset) === 0) {
        try {
          const folderInfo = await imapOps.getFolderMessageCount('INBOX');
          totalCount = folderInfo.total;
          console.log(`Total messages in INBOX: ${totalCount}`);
        } catch (err) {
          console.error('Failed to get total count:', err);
          totalCount = -1;
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`[inbox] === COMPLETE === ${elapsed}ms`);

      // Now apply filtering and pagination on the enriched dataset
      let resultMessages: any[] = [];

      if (showAll === 'false') {
        // Filter out messages that have been acted upon
        const unprocessedMessages = enrichedMessages.filter(msg =>
          msg.actionTaken === 'none' || !msg.actionTaken
        );
        console.log(`Filtered from ${enrichedMessages.length} to ${unprocessedMessages.length} messages`);

        // For filtered mode, skip to the target offset in the filtered list
        // and take the requested limit
        resultMessages = unprocessedMessages.slice(targetOffset, targetOffset + targetLimit);

        // If we don't have enough messages, we need to fetch more from IMAP
        // This is a limitation of the current approach - we'd need to implement
        // continuous fetching to handle all cases properly
        if (resultMessages.length < targetLimit && messages.length === BATCH_SIZE) {
          console.log(`Warning: May need to fetch more messages. Got ${resultMessages.length}, wanted ${targetLimit}`);
        }
      } else {
        // For show-all mode, pagination is straightforward
        resultMessages = enrichedMessages.slice(0, targetLimit);
      }

      return {
        messages: resultMessages,
        total: totalCount,
        offset: Number(offset),
        limit: Number(limit)
      };
    }, 'Failed to fetch inbox');

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[inbox] === ERROR === ${elapsed}ms`, error);
    // Map OAuth refresh failures to 401 so client can prompt re-auth
    if (error?.code === 'AUTH_REFRESH_FAILED') {
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
  }
});

// Reset action taken for an email (force evaluation)
router.post('/emails/:accountId/reset-action', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.params;
    const { messageId } = req.body;

    if (!messageId) {
      res.status(400).json({ error: 'Message ID is required' });
      return;
    }

    // Validate account belongs to user (required since EmailActionTracker doesn't validate ownership)
    const accountCheck = await pool.query(
      'SELECT id FROM email_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (accountCheck.rows.length === 0) {
      res.status(404).json({ error: 'Email account not found' });
      return;
    }

    await EmailActionTracker.resetAction(accountId, messageId);

    res.json({
      success: true,
      message: 'Email action reset successfully'
    });
  } catch (error: any) {
    console.error('Failed to reset email action:', error);
    res.status(500).json({
      error: 'Failed to reset email action',
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