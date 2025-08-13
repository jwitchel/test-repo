import express from 'express';
import { requireAuth } from '../middleware/auth';
import { ToneLearningOrchestrator } from '../lib/pipeline/tone-learning-orchestrator';
import { ProcessedEmail } from '../lib/pipeline/types';
import { imapLogger } from '../lib/imap-logger';
import PostalMime from 'postal-mime';
import { pool } from '../server';

const router = express.Router();

// Initialize orchestrator
let orchestrator: ToneLearningOrchestrator | null = null;

async function ensureOrchestratorInitialized() {
  if (!orchestrator) {
    orchestrator = new ToneLearningOrchestrator();
    await orchestrator.initialize();
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
  originalHtml?: string
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
  
  // Plain text version
  const quotedBody = originalBody
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
  
  const textReply = `${formattedReply}

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
    
    // Simple HTML structure that works well with email clients
    htmlReply = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
${replyHtml}
${typedNameHtml}
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
    
    // Initialize orchestrator
    await ensureOrchestratorInitialized();
    
    // Initialize pattern analyzer with the selected provider
    await orchestrator!['patternAnalyzer'].initialize(providerId);
    
    // Create a ProcessedEmail object for the orchestrator
    const processedEmail: ProcessedEmail = {
      uid: messageId,
      messageId: messageId,
      inReplyTo: null,
      date: parsed.date ? new Date(parsed.date) : new Date(),
      from: [{ address: fromAddress, name: fromName }],
      to: [{ address: userEmail }],
      cc: [],
      bcc: [],
      subject: subject,
      textContent: emailBody,
      htmlContent: parsed.html || null,
      userReply: emailBody,  // For incoming emails, this is what we're analyzing
      respondedTo: ''  // Empty since this is the original email
    };
    
    // Generate the draft using the orchestrator
    const draft = await orchestrator!.generateDraft({
      incomingEmail: processedEmail,
      recipientEmail: fromAddress,
      config: {
        userId,
        templateName: 'standard'
      }
    });
    
    // Get user's typed name preference
    const userResult = await pool.query(
      'SELECT preferences FROM "user" WHERE id = $1',
      [userId]
    );
    
    let typedNameSignature = '';
    if (userResult.rows.length > 0 && userResult.rows[0].preferences?.typedName) {
      const typedName = userResult.rows[0].preferences.typedName;
      // Check for appendString directly (some users might not have 'enabled' field)
      if (typedName.appendString) {
        typedNameSignature = typedName.appendString;
      }
    }
    
    // Format the complete reply email with typed name signature
    const formattedReply = formatReplyEmail(
      fromName || fromAddress,
      fromAddress,
      parsed.date ? new Date(parsed.date) : new Date(),
      emailBody,
      draft.body,
      typedNameSignature,
      parsed.html || undefined
    );
    
    // Create reply subject
    const replySubject = subject.toLowerCase().startsWith('re:') 
      ? subject 
      : `Re: ${subject}`;
    
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
    
    res.json({
      success: true,
      draft: {
        id: draft.id,
        from: userEmail,
        to: fromName && fromName !== fromAddress 
          ? `${fromName} <${fromAddress}>` 
          : fromAddress,
        subject: replySubject,
        body: formattedReply.text,
        bodyHtml: formattedReply.html,
        inReplyTo: messageId,
        references: messageId,
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