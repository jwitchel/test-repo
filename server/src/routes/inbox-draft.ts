import express from 'express';
import { requireAuth } from '../middleware/auth';
import { ToneLearningOrchestrator } from '../lib/pipeline/tone-learning-orchestrator';
import { ProcessedEmail } from '../lib/pipeline/types';
import { imapLogger } from '../lib/imap-logger';
import PostalMime from 'postal-mime';
import { pool } from '../server';
import { VectorStore } from '../lib/vector/qdrant-client';
import { EmbeddingService } from '../lib/vector/embedding-service';
import { EmailAttachmentStripper } from '../lib/email-attachment-stripper';

const router = express.Router();

// Initialize services
let orchestrator: ToneLearningOrchestrator | null = null;
let vectorStore: VectorStore | null = null;
let embeddingService: EmbeddingService | null = null;

async function ensureServicesInitialized() {
  if (!orchestrator) {
    orchestrator = new ToneLearningOrchestrator();
    await orchestrator.initialize();
  }
  if (!vectorStore) {
    vectorStore = new VectorStore();
    await vectorStore.initialize();
  }
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
  }
}

// Format reply with quoted original message
function formatReplyEmail(
  originalFromName: string,
  originalFromEmail: string,
  originalDate: Date,
  originalBody: string,
  replyBody: string,
  typedName?: string,
  originalHtml?: string,
  signatureBlock?: string
): { text: string; html?: string } {
  // Format date to match email client format: "August 12, 2025 at 4:44:56 PM"
  const formattedDate = originalDate.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  
  // Add "at" between date and time
  const dateParts = formattedDate.split(', ');
  const dateFormatted = dateParts.length === 3 
    ? `${dateParts[0]}, ${dateParts[1]} at ${dateParts[2]}`
    : formattedDate;
  
  // Format the sender info with email in parentheses
  const senderInfo = originalFromName && originalFromName !== originalFromEmail
    ? `${originalFromName} (${originalFromEmail})`
    : originalFromEmail;
  
  // Create email link for HTML version
  const senderInfoHtml = originalFromName && originalFromName !== originalFromEmail
    ? `${originalFromName} (<a href="mailto:${originalFromEmail}">${originalFromEmail}</a>)`
    : `<a href="mailto:${originalFromEmail}">${originalFromEmail}</a>`;
  
  // Build the reply with typed name if provided
  let formattedReply = replyBody;
  if (typedName) {
    // Ensure there's a line break before the typed name
    formattedReply = `${replyBody}\n${typedName}`;
  }
  
  // Add signature block if provided
  let finalTextReply = formattedReply;
  if (signatureBlock) {
    finalTextReply = `${formattedReply}\n${signatureBlock}`;
  }
  
  // Plain text version
  const quotedBody = originalBody
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
  
  const textReply = `${finalTextReply}

On ${dateFormatted}, ${senderInfo} wrote:

${quotedBody}`;
  
  // HTML version if original had HTML
  let htmlReply: string | undefined;
  if (originalHtml) {
    // Convert reply body to HTML with proper paragraph handling
    const replyLines = replyBody.split('\n');
    const replyHtml = replyLines
      .map(line => {
        if (line.trim() === '') {
          return '<br>';
        }
        // Escape HTML entities
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        return `<p style="margin: 0 0 1em 0;">${escaped}</p>`;
      })
      .join('\n');
    
    // Format typed name for HTML
    let typedNameHtml = '';
    if (typedName) {
      const escapedTypedName = typedName
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      typedNameHtml = `<p style="margin: 0;">${escapedTypedName}</p>`;
    }
    
    // Format signature block for HTML
    let signatureHtml = '';
    if (signatureBlock) {
      const signatureLines = signatureBlock.split('\n');
      signatureHtml = signatureLines
        .map(line => {
          const escaped = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
          return `<p style="margin: 0;">${escaped}</p>`;
        })
        .join('\n');
    }
    
    // Simple HTML structure that works well with email clients
    htmlReply = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
${replyHtml}
${typedNameHtml}
${signatureHtml ? `<div style="margin-top: 1em;">${signatureHtml}</div>` : ''}
<br>
<div style="margin-top: 1em;">On ${dateFormatted}, ${senderInfoHtml} wrote:</div>
<blockquote type="cite" style="margin: 1em 0 0 0; padding-left: 1em; border-left: 2px solid #ccc;">
${originalHtml}
</blockquote>
</div>`;
  }
  
  return { text: textReply, html: htmlReply };
}

// Generate draft from inbox email
router.post('/generate-draft', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { 
      rawMessage,
      emailAccountId,
      providerId
    } = req.body;
    
    if (!rawMessage || !emailAccountId || !providerId) {
      res.status(400).json({ 
        error: 'Missing required fields: rawMessage, emailAccountId, providerId' 
      });
      return;
    }
    
    // Parse the raw email
    const parser = new PostalMime();
    const parsed = await parser.parse(rawMessage);
    
    // Extract email details
    const fromAddress = parsed.from?.address || '';
    const fromName = parsed.from?.name || parsed.from?.address || '';
    const subject = parsed.subject || '';
    const toAddresses = parsed.to || [];
    const ccAddresses = parsed.cc || [];
    
    // Extract email body - if HTML exists, convert it to plain text
    let emailBody = parsed.text || '';
    
    
    if (!emailBody && parsed.html) {
      // Simple HTML to text conversion - remove tags
      emailBody = parsed.html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    if (!emailBody) {
      console.error('No email body found in parsed message');
      res.status(400).json({ error: 'Email has no readable content' });
      return;
    }
    
    const messageId = parsed.messageId || `<${Date.now()}@${emailAccountId}>`;
    
    // Get user's email from the account
    const accountResult = await pool.query(
      'SELECT email_address FROM email_accounts WHERE id = $1 AND user_id = $2',
      [emailAccountId, userId]
    );
    
    if (accountResult.rows.length === 0) {
      res.status(404).json({ error: 'Email account not found' });
      return;
    }
    
    const userEmail = accountResult.rows[0].email_address;
    
    // Log the start of draft generation
    imapLogger.log(userId, {
      userId,
      emailAccountId,
      level: 'info',
      command: 'DRAFT_GENERATION_START',
      data: {
        parsed: {
          from: fromAddress,
          subject: subject,
          providerId: providerId
        }
      }
    });
    
    // Initialize services
    await ensureServicesInitialized();
    
    // Initialize pattern analyzer with the selected provider
    await orchestrator!['patternAnalyzer'].initialize(providerId);
    
    // Store incoming email in Qdrant
    imapLogger.log(userId, {
      userId,
      emailAccountId,
      level: 'info',
      command: 'STORING_INCOMING_EMAIL',
      data: {
        parsed: {
          messageId: messageId,
          from: fromAddress,
          subject: subject
        }
      }
    });
    
    // Generate embedding for the email content
    const emailVector = await embeddingService!.embedText(emailBody);
    
    
    // Check if email has attachments for metadata tracking
    const hasAttachments = EmailAttachmentStripper.hasAttachments(rawMessage);
    let attachmentInfo: {
      hasAttachments?: boolean;
      attachmentSizeKB?: number;
      attachmentCount?: number;
    } = {};
    
    if (hasAttachments) {
      // Calculate size metrics for logging
      const originalSize = rawMessage.length;
      const strippedForStorage = await EmailAttachmentStripper.stripAttachments(rawMessage);
      const strippedSize = strippedForStorage.length;
      const sizeMetrics = EmailAttachmentStripper.calculateSizeReduction(originalSize, strippedSize);
      
      attachmentInfo = {
        hasAttachments: true,
        attachmentSizeKB: sizeMetrics.reductionKB,
        attachmentCount: parsed.attachments ? parsed.attachments.length : 0
      };
    }
    
    // Store the incoming email in Qdrant
    await vectorStore!.upsertEmail({
      id: messageId,
      userId,
      vector: emailVector.vector,
      metadata: {
        emailId: messageId,
        userId,
        emailType: 'incoming', // Changed from 'type' to avoid conflicts
        senderEmail: fromAddress,
        senderName: fromName || fromAddress,
        subject: subject,
        sentDate: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
        rawText: emailBody,
        features: {}, // Add empty features for now
        relationship: {
          type: 'unknown',
          confidence: 0,
          detectionMethod: 'none'
        },
        userReply: '', // Empty for incoming emails
        respondedTo: '',
        recipientEmail: userEmail,
        redactedNames: [],
        redactedEmails: [],
        wordCount: emailBody.split(/\s+/).length,
        frequencyScore: 0,
        eml_file: rawMessage, // Store raw RFC 5322 message (with attachments for archival)
        ...attachmentInfo // Add attachment tracking info if present
      }
    });
    
    // Create a ProcessedEmail object for the orchestrator
    const processedEmail: ProcessedEmail = {
      uid: messageId,
      messageId: messageId,
      inReplyTo: null,
      date: parsed.date ? new Date(parsed.date) : new Date(),
      from: [{ address: fromAddress, name: fromName }],
      to: toAddresses.map(addr => ({ address: addr.address || '', name: addr.name || '' })),
      cc: ccAddresses.map(addr => ({ address: addr.address || '', name: addr.name || '' })),
      bcc: [],
      subject: subject,
      textContent: emailBody,
      htmlContent: parsed.html || null,
      userReply: emailBody,  // For incoming emails, this is what we're analyzing
      respondedTo: '',  // Empty since this is the original email
      rawMessage: rawMessage  // Include raw RFC 5322 message for spam check
    };
    
    // Get user's preferences including name and typed name first
    const userResult = await pool.query(
      'SELECT name, preferences FROM "user" WHERE id = $1',
      [userId]
    );
    
    let userNames;
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const preferences = user.preferences || {};
      
      // Get user names for detection
      userNames = {
        name: preferences.name || user.name || '',
        nicknames: preferences.nicknames || ''
      };
    }
    
    // Generate the draft using the orchestrator with retry logic
    let draft;
    let retryCount = 0;
    const maxRetries = 1; // Allow one retry
    
    while (retryCount <= maxRetries) {
      try {
        draft = await orchestrator!.generateDraft({
          incomingEmail: processedEmail,
          recipientEmail: fromAddress,
          config: {
            userId,
            userNames
          }
        });
        break; // Success, exit the loop
      } catch (error: any) {
        // Check if it's the specific JSON structure error
        if (error.message?.includes('Invalid response structure: missing meta or message') && 
            retryCount < maxRetries) {
          retryCount++;
          
          imapLogger.log(userId, {
            userId,
            emailAccountId,
            level: 'warn',
            command: 'DRAFT_GENERATION_RETRY',
            data: {
              parsed: {
                error: error.message,
                retryAttempt: retryCount,
                emailSubject: subject,
                emailFrom: fromAddress
              }
            }
          });
          
          // Continue to next iteration for retry
          continue;
        }
        // If it's not the specific error or we've exhausted retries, throw
        throw error;
      }
    }
    
    if (!draft) {
      throw new Error('Failed to generate draft after retries');
    }
    
    // Check if this is an silent action
    const ignoreActions = ['silent-fyi-only', 'silent-large-list', 'silent-unsubscribe', 'silent-spam'];
    const isIgnoreAction = draft.meta && ignoreActions.includes(draft.meta.recommendedAction);
    
    let formattedReply: { text: string; html?: string } = { text: '', html: undefined };
    let replySubject = subject;
    
    if (!isIgnoreAction) {
      // Only format as reply for non-silent actions
      // Get typed name signature and signature block from user result we already fetched
      let typedNameSignature = '';
      let signatureBlock = '';
      if (userResult.rows.length > 0) {
        const preferences = userResult.rows[0].preferences || {};
        
        // Get typed name signature
        if (preferences.typedName?.appendString) {
          typedNameSignature = preferences.typedName.appendString;
        }
        
        // Get signature block
        if (preferences.signatureBlock) {
          signatureBlock = preferences.signatureBlock;
        }
      }
      
      // Format the complete reply email with typed name signature and signature block
      formattedReply = formatReplyEmail(
        fromName || fromAddress,
        fromAddress,
        parsed.date ? new Date(parsed.date) : new Date(),
        emailBody,
        draft.body,
        typedNameSignature,
        parsed.html || undefined,
        signatureBlock
      );
      
      // Create reply subject
      replySubject = subject.toLowerCase().startsWith('re:') 
        ? subject 
        : `Re: ${subject}`;
    }
    
    imapLogger.log(userId, {
      userId,
      emailAccountId,
      level: 'info',
      command: 'DRAFT_GENERATION_COMPLETE',
      data: {
        parsed: {
          draftId: draft.id,
          wordCount: draft.body.split(/\s+/).length,
          relationship: draft.relationship.type
        }
      }
    });
    
    // Store LLM metadata back to Qdrant
    if (draft.meta) {
      imapLogger.log(userId, {
        userId,
        emailAccountId,
        level: 'info',
        command: 'STORING_LLM_METADATA',
        data: {
          parsed: {
            messageId: messageId,
            inboundMsgAddressedTo: draft.meta.inboundMsgAddressedTo,
            recommendedAction: draft.meta.recommendedAction
          }
        }
      });
      
      // Update the email in Qdrant with LLM response metadata
      // For now, we'll create a new embedding with the response included
      const updatedContent = `${emailBody}\n\nGenerated Response:\n${draft.body}`;
      const updatedVector = await embeddingService!.embedText(updatedContent);
      
      await vectorStore!.upsertEmail({
        id: messageId,
        userId,
        vector: updatedVector.vector,
        metadata: {
          emailId: messageId,
          userId,
          emailType: 'incoming',
          senderEmail: fromAddress,
          senderName: fromName || fromAddress,
          subject: subject,
          sentDate: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
          rawText: emailBody,
          features: {},
          relationship: draft.relationship,
          userReply: draft.body, // Store the generated response
          respondedTo: emailBody,
          recipientEmail: userEmail,
          redactedNames: [],
          redactedEmails: [],
          wordCount: emailBody.split(/\s+/).length,
          frequencyScore: 0,
          eml_file: rawMessage,
          ...attachmentInfo, // Include attachment info that was calculated earlier
          llmResponse: {
            meta: draft.meta,
            generatedAt: new Date().toISOString(),
            providerId: providerId,
            modelName: (orchestrator && orchestrator['patternAnalyzer'] && orchestrator['patternAnalyzer']['llmClient']) 
              ? orchestrator['patternAnalyzer']['llmClient'].getModelInfo().name 
              : 'unknown',
            draftId: draft.id,
            relationship: draft.relationship
          }
        }
      });
    }
    
    // Determine recipients based on recommended action
    let recipients = fromName && fromName !== fromAddress 
      ? `${fromName} <${fromAddress}>` 
      : fromAddress;
    
    let ccRecipients = '';
    
    if (draft.meta?.recommendedAction === 'reply-all') {
      // For reply-all, include all original recipients
      const allRecipients: string[] = [];
      const allCc: string[] = [];
      
      // Add the sender to recipients
      allRecipients.push(recipients);
      
      // Add all TO recipients (except the user)
      toAddresses.forEach(addr => {
        if (addr.address && addr.address.toLowerCase() !== userEmail.toLowerCase()) {
          const formatted = addr.name && addr.name !== addr.address
            ? `${addr.name} <${addr.address}>`
            : addr.address;
          allRecipients.push(formatted);
        }
      });
      
      // Add all CC recipients (except the user)
      ccAddresses.forEach(addr => {
        if (addr.address && addr.address.toLowerCase() !== userEmail.toLowerCase()) {
          const formatted = addr.name && addr.name !== addr.address
            ? `${addr.name} <${addr.address}>`
            : addr.address;
          allCc.push(formatted);
        }
      });
      
      // Join recipients
      recipients = allRecipients.join(', ');
      ccRecipients = allCc.join(', ');
    }
    
    res.json({
      success: true,
      draft: {
        id: draft.id,
        from: userEmail,
        to: recipients,
        cc: ccRecipients,
        subject: replySubject,
        body: formattedReply.text,
        bodyHtml: formattedReply.html,
        inReplyTo: messageId,
        references: messageId,
        meta: draft.meta,
        relationship: draft.relationship,
        metadata: {
          ...draft.metadata,
          originalSubject: subject,
          originalFrom: fromAddress
        }
      }
    });
    
  } catch (error) {
    console.error('Error generating draft:', error);
    
    const userId = (req as any).user.id;
    imapLogger.log(userId, {
      userId,
      emailAccountId: req.body.emailAccountId || 'unknown',
      level: 'error',
      command: 'DRAFT_GENERATION_ERROR',
      data: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    
    res.status(500).json({ 
      error: 'Failed to generate draft',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;