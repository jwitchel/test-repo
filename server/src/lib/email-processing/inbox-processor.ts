/**
 * InboxProcessor Service
 * Consolidated business logic for processing inbox emails
 * Used by both UI and batch processing (workers, routes)
 */

import { ImapOperations } from '../imap-operations';
import { EmailActionTracker } from '../email-action-tracker';
import { EmailActionRouter } from '../email-action-router';
import { pool } from '../../server';
import { draftGenerator } from './draft-generator';
import { emailMover } from './email-mover';
import { withImapContext } from '../imap-context';

// Silent actions that don't require draft creation
const SILENT_ACTIONS = ['silent-fyi-only', 'silent-large-list', 'silent-unsubscribe', 'silent-spam'];

export interface ProcessEmailParams {
  message: {
    uid: number;
    messageId?: string;
    subject?: string;
    from?: string;
    rawMessage: string;
  };
  accountId: string;
  userId: string;
  providerId: string;
  dryRun: boolean;
  generatedDraft?: any; // Optional pre-generated draft to avoid LLM non-determinism
}

export interface ProcessEmailResult {
  success: boolean;
  messageId?: string;
  subject?: string;
  from?: string;
  action: string;
  actionDescription: string;
  destination: string;
  draftId?: string;
  moved: boolean;
  dryRun: boolean;
  error?: string;
}

export interface BatchProcessParams {
  accountId: string;
  userId: string;
  providerId: string;
  dryRun: boolean;
  batchSize: number;
  offset: number;
  force?: boolean;
}

export interface BatchProcessResult {
  success: boolean;
  processed: number;
  results: ProcessEmailResult[];
  hasMore: boolean;
  nextOffset: number;
  elapsed: number;
}

export class InboxProcessor {
  /**
   * Process a single email - follows the exact logic from /inbox page
   */
  async processEmail(params: ProcessEmailParams): Promise<ProcessEmailResult> {
    const { message, accountId, userId, providerId, dryRun, generatedDraft: existingDraft } = params;

    try {
      let generatedDraft: any;

      // Step 1: Use existing draft if provided, otherwise generate new one
      if (existingDraft) {
        console.log(`[InboxProcessor] Using pre-generated draft for message ${message.messageId}`);
        generatedDraft = existingDraft;
      } else {
        console.log(`[InboxProcessor] Generating draft for message ${message.messageId}`);

        const draftResponse = await draftGenerator.generateDraft({
          rawMessage: message.rawMessage,
          emailAccountId: accountId,
          providerId,
          userId
        });

        if (!draftResponse.success || !draftResponse.draft) {
          throw new Error(draftResponse.error || 'Failed to generate draft');
        }

        generatedDraft = draftResponse.draft;
      }

      const recommendedAction = generatedDraft.meta.recommendedAction; // Always present

      let moved = false;
      let destination = 'INBOX';
      let actionDescription = 'Reply sent';

      // Step 2: Process based on action type (matching /inbox page logic exactly)
      if (!dryRun) {
        try {
          if (SILENT_ACTIONS.includes(recommendedAction)) {
            // For silent actions, just move the email (no draft to upload)
            console.log(`[InboxProcessor] Silent action ${recommendedAction} - moving message ${message.uid}`);

            const moveResponse = await emailMover.moveEmail({
              emailAccountId: accountId,
              userId,
              messageUid: message.uid,
              messageId: message.messageId,
              sourceFolder: 'INBOX',
              recommendedAction
            });

            if (moveResponse.success) {
              moved = true;
              destination = moveResponse.folder || destination;
              actionDescription = moveResponse.message || `Moved to ${destination}`;
            }
          } else {
            // For other actions (reply, etc), upload the draft which also moves the original
            console.log(`[InboxProcessor] Uploading draft for message ${message.messageId}`);

            const uploadResponse = await emailMover.uploadDraft({
              emailAccountId: accountId,
              userId,
              to: generatedDraft.to,
              cc: generatedDraft.cc,
              subject: generatedDraft.subject,
              body: generatedDraft.body,
              bodyHtml: generatedDraft.bodyHtml,
              inReplyTo: generatedDraft.inReplyTo,
              references: generatedDraft.references,
              recommendedAction
            });

            if (uploadResponse.success) {
              moved = true;
              destination = uploadResponse.folder || destination;
              actionDescription = uploadResponse.message || 'Draft created and email moved';
            }
          }
        } catch (moveError) {
          console.error(`[InboxProcessor] Failed to process message ${message.messageId}:`, moveError);
          throw moveError;
        }
      } else {
        // In dry-run mode, determine what would happen without making changes
        // Get folder routing info for display
        const userResult = await pool.query(
          'SELECT preferences FROM "user" WHERE id = $1',
          [userId]
        );
        const folderPrefs = userResult.rows[0]?.preferences?.folders;
        const actionRouter = new EmailActionRouter(folderPrefs, 'Drafts');

        if (recommendedAction !== 'reply') {
          const route = actionRouter.getActionRoute(recommendedAction as any);
          destination = route.folder;
          actionDescription = `DRY-RUN: Would ${SILENT_ACTIONS.includes(recommendedAction) ? 'move' : 'reply and move'} to ${destination}`;
        } else {
          actionDescription = 'DRY-RUN: Would send reply';
        }
        console.log(`[InboxProcessor] DRY-RUN: Message ${message.uid} - ${actionDescription}`);
      }

      return {
        success: true,
        messageId: message.messageId,
        subject: message.subject,
        from: message.from,
        action: recommendedAction,
        actionDescription,
        destination,
        draftId: generatedDraft?.id,
        moved,
        dryRun
      };

    } catch (error) {
      console.error(`[InboxProcessor] Error processing message ${message.messageId}:`, error);
      return {
        success: false,
        messageId: message.messageId,
        subject: message.subject,
        from: message.from,
        action: 'error',
        actionDescription: 'Failed to process',
        destination: 'INBOX',
        moved: false,
        dryRun,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process a batch of emails
   * Wrapped in withImapContext to ensure single connection reuse and guaranteed cleanup
   */
  async processBatch(params: BatchProcessParams): Promise<BatchProcessResult> {
    const startTime = Date.now();
    const { accountId, userId, providerId, dryRun, batchSize, offset, force } = params;

    console.log(`[SERVER] [InboxProcessor] ${dryRun ? '[DRY RUN] ' : ''}Processing batch: accountId=${accountId}, batchSize=${batchSize}, offset=${offset}, dryRun=${dryRun}`);

    // Wrap entire batch operation in IMAP context to ensure:
    // 1. Single connection reused across all IMAP operations
    // 2. Guaranteed connection cleanup even on errors
    // 3. Nested operations (emailMover calls) share the same connection
    return await withImapContext(accountId, userId, async () => {
      try {
        const imapOps = await ImapOperations.fromAccountId(accountId, userId);
        const results: ProcessEmailResult[] = [];

        // Fetch messages from inbox with pagination
        console.log(`[InboxProcessor] Fetching ${batchSize} messages from INBOX starting at offset ${offset}`);
        const messages = await imapOps.getMessages('INBOX', {
          offset: Number(offset),
          limit: Number(batchSize),
          descending: true
        });

        if (messages.length === 0) {
          console.log('[InboxProcessor] No messages found in INBOX');
          return {
            success: true,
            processed: 0,
            results: [],
            hasMore: false,
            nextOffset: offset,
            elapsed: Date.now() - startTime
          };
        }

        // Batch fetch full message details
        const uids = messages.map(msg => msg.uid);
        console.log(`[InboxProcessor] Batch fetching ${uids.length} messages`);
        const fullMessages = await imapOps.getMessagesRaw('INBOX', uids);

        // Get action tracking for all messages to filter already processed
        // In dry-run mode, process all messages regardless of tracking (to show what would happen)
        const messageIds = fullMessages.map(msg => msg.messageId).filter((id): id is string => !!id);
        const actionTracking = dryRun ? {} : await EmailActionTracker.getActionsForMessages(accountId, messageIds);

        // Filter to unprocessed messages (unless force is true or dry-run mode)
        const toProcess = fullMessages.filter(msg => {
          if (!msg.messageId) return false;
          if (dryRun) return true; // Process all in dry-run mode
          const tracked = actionTracking[msg.messageId];
          const shouldProcess = force || !tracked || tracked.actionTaken === 'none';
          if (!shouldProcess) {
            console.log(`[InboxProcessor] Skipping already processed: ${msg.messageId}`);
          }
          return shouldProcess;
        });

        console.log(`[InboxProcessor] Processing ${toProcess.length} of ${fullMessages.length} messages`);

        // Process each email
        for (const msg of toProcess) {
          const result = await this.processEmail({
            message: {
              uid: msg.uid,
              messageId: msg.messageId,
              subject: msg.subject,
              from: msg.from,
              rawMessage: msg.rawMessage
            },
            accountId,
            userId,
            providerId,
            dryRun
          });

          results.push(result);
        }

        // Check if there are more messages to process
        const hasMore = messages.length === batchSize;
        const nextOffset = offset + messages.length;

        return {
          success: true,
          processed: results.length,
          results,
          hasMore,
          nextOffset,
          elapsed: Date.now() - startTime
        };

      } catch (error) {
        console.error('[InboxProcessor] Batch processing error:', error);
        throw error;
      }
    });
  }
}

// Export singleton instance
export const inboxProcessor = new InboxProcessor();