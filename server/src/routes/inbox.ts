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
    generatedDraft
  } = req.body;

  // Validate required fields
  if (!emailAccountId || !rawMessage || !providerId || !messageUid) {
    res.status(400).json({
      error: 'Missing required fields: emailAccountId, rawMessage, providerId, messageUid'
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
      generatedDraft
    });

    if (result.success) {
      // Email was successfully processed
      res.json({
        success: true,
        folder: result.destination,
        message: result.actionDescription,
        action: result.action,
        draftId: result.draftId
      });
    } else {
      // Email processing failed (including skipped due to lock)
      const statusCode = result.action === 'skipped' ? 409 : 500;  // 409 Conflict for lock contention
      res.status(statusCode).json({
        error: result.action === 'skipped' ? 'Email is being processed by another request' : 'Failed to process email',
        message: result.error || result.actionDescription
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
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.params;
    const { offset = 0, limit = 1, showAll = 'false' } = req.query;

    await withImapJson(res, accountId, userId, async () => {
      // Account validation happens in ImapOperations.fromAccountId()
      const imapOps = await ImapOperations.fromAccountId(accountId, userId);

      const targetOffset = Number(offset);
      const targetLimit = Number(limit);
      const BATCH_SIZE = parseInt(process.env.INBOX_BATCH_SIZE || '10', 10);
      let totalCount = -1;
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
        } catch (err) {
          console.error('Failed to get total count:', err);
          totalCount = -1;
        }
      }

      // Now apply filtering and pagination on the enriched dataset
      let resultMessages: any[] = [];

      if (showAll === 'false') {
        // Filter out messages that have been acted upon
        const unprocessedMessages = enrichedMessages.filter(msg =>
          msg.actionTaken === 'none' || !msg.actionTaken
        );

        // For filtered mode, skip to the target offset in the filtered list
        // and take the requested limit
        resultMessages = unprocessedMessages.slice(targetOffset, targetOffset + targetLimit);
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
    console.error('[inbox] Error fetching inbox:', error);
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

// Get a specific email by messageId from Qdrant
router.get('/email/:accountId/:messageId', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { accountId, messageId } = req.params;

    console.log('[inbox-get-email] Looking for email:', { userId, accountId, messageId });

    // Validate account belongs to user
    const accountCheck = await pool.query(
      'SELECT id FROM email_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (accountCheck.rows.length === 0) {
      console.log('[inbox-get-email] Account not found or unauthorized');
      res.status(404).json({ error: 'Email account not found' });
      return;
    }

    // Fetch email from Qdrant
    const { VectorStore, RECEIVED_COLLECTION } = await import('../lib/vector/qdrant-client');
    const vectorStore = new VectorStore();
    await vectorStore.initialize();

    let email = await vectorStore.getByMessageId(userId, accountId, messageId, RECEIVED_COLLECTION);

    // If not found in Qdrant, check if it exists in action tracking and has a UID we can use
    if (!email) {
      console.log('[inbox-get-email] Email not found in Qdrant, checking action tracking for UID...');

      // Check if this email exists in the action tracking table with a UID
      const actionRecord = await pool.query(
        `SELECT eat.message_id, eat.uid, eat.subject, eat.created_at
         FROM email_action_tracking eat
         WHERE eat.email_account_id = $1 AND eat.message_id = $2
         LIMIT 1`,
        [accountId, messageId]
      );

      if (actionRecord.rows.length > 0 && actionRecord.rows[0].uid) {
        const uid = actionRecord.rows[0].uid;
        console.log('[inbox-get-email] Found UID in action tracking, fetching from IMAP:', { uid });

        // Fetch from IMAP using the UID
        try {
          const imapOps = await ImapOperations.fromAccountId(accountId, userId);
          const messages = await imapOps.getMessagesRaw('INBOX', [uid]);

          if (messages.length > 0) {
            const msg = messages[0];
            console.log('[inbox-get-email] Retrieved email from IMAP');

            // Return the email in the same format as Qdrant would
            res.json({
              success: true,
              email: {
                messageId: msg.messageId || messageId,
                subject: msg.subject || actionRecord.rows[0].subject || '(No subject)',
                from: msg.from || 'Unknown',
                fromName: undefined,
                to: msg.to || [],
                cc: [], // CC not available from IMAP basic fetch
                date: msg.date?.toISOString() || actionRecord.rows[0].created_at,
                rawMessage: msg.rawMessage || '',
                uid: msg.uid,
                flags: msg.flags || [],
                size: msg.size || 0,
                // No LLM response available when fetching from IMAP directly
                llmResponse: undefined,
                relationship: undefined
              }
            });
            return;
          }
        } catch (imapError) {
          console.error('[inbox-get-email] Failed to fetch from IMAP:', imapError);
        }
      }

      console.log('[inbox-get-email] Email not found in Qdrant or IMAP with filters:', { userId, accountId, messageId });
      res.status(404).json({
        error: 'Email not available',
        message: 'This email was processed before the history feature was implemented. Only newly processed emails can be viewed from history. Please process new emails to see them here.'
      });
      return;
    }

    console.log('[inbox-get-email] Email found in Qdrant:', { emailId: email.metadata.emailId });

    // Return email data with metadata
    res.json({
      success: true,
      email: {
        messageId: email.metadata.emailId,
        subject: email.metadata.subject,
        from: email.metadata.senderEmail || email.metadata.from,
        fromName: email.metadata.senderName,
        to: email.metadata.to || [],
        cc: email.metadata.cc || [],
        date: email.metadata.sentDate,
        rawMessage: email.metadata.eml_file,
        uid: email.metadata.uid,
        flags: email.metadata.flags || [],
        size: email.metadata.size || 0,
        // Include LLM response metadata if available
        llmResponse: email.metadata.llmResponse,
        relationship: email.metadata.relationship
      }
    });

  } catch (error) {
    console.error('Error fetching email by messageId:', error);
    res.status(500).json({
      error: 'Failed to fetch email',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;