/**
 * InboxProcessor Service
 * Consolidated business logic for processing inbox emails
 * Used by both UI and batch processing (workers, routes)
 */

import { ImapOperations } from '../imap-operations';
import { EmailActionTracker } from '../email-action-tracker';
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
  error?: string;
}

export interface BatchProcessParams {
  accountId: string;
  userId: string;
  providerId: string;
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
    const { message, accountId, userId, providerId, generatedDraft: existingDraft } = params;

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

      return {
        success: true,
        messageId: message.messageId,
        subject: message.subject,
        from: message.from,
        action: recommendedAction,
        actionDescription,
        destination,
        draftId: generatedDraft?.id,
        moved
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
    const { accountId, userId, providerId, batchSize, offset, force } = params;

    console.log(`[SERVER] [InboxProcessor] Processing batch: accountId=${accountId}, batchSize=${batchSize}, offset=${offset}`);

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
        const messageIds = fullMessages.map(msg => msg.messageId).filter((id): id is string => !!id);
        const actionTracking = await EmailActionTracker.getActionsForMessages(accountId, messageIds);

        // Filter to unprocessed messages (unless force is true)
        const toProcess = fullMessages.filter(msg => {
          if (!msg.messageId) return false;
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
            providerId
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