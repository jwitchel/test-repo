import express from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../server';
import { ImapOperations } from '../lib/imap-operations';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import { EmailActionRouter } from '../lib/email-action-router';
import { LLMMetadata } from '../lib/llm-client';

const router = express.Router();

interface UploadDraftRequest {
  emailAccountId: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  inReplyTo?: string;
  references?: string;
  recommendedAction?: LLMMetadata['recommendedAction'];
}

// Helper function to create RFC2822 formatted email using nodemailer
async function createEmailMessage(
  from: string,
  to: string,
  subject: string,
  body: string,
  bodyHtml?: string,
  cc?: string,
  inReplyTo?: string,
  references?: string
): Promise<string> {
  // Create a transport that doesn't actually send but builds the message
  const transporter = nodemailer.createTransport({
    streamTransport: true,
    buffer: true
  });
  
  const messageId = `<${uuidv4()}@ai-email-assistant>`;
  
  const mailOptions: nodemailer.SendMailOptions = {
    from,
    to,
    subject,
    messageId,
    date: new Date(),
    text: body
  };
  
  // Add CC if provided
  if (cc) {
    mailOptions.cc = cc;
  }
  
  // Add HTML if provided
  if (bodyHtml) {
    mailOptions.html = bodyHtml;
  }
  
  // Add reply headers if provided
  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo;
  }
  
  if (references) {
    mailOptions.references = references;
  }
  
  // Build the message
  const info = await transporter.sendMail(mailOptions);
  const message = info.message.toString();
  
  return message;
}

// Upload draft email to IMAP folder
router.post('/upload-draft', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const {
      emailAccountId,
      to,
      cc,
      subject,
      body,
      inReplyTo,
      references,
      recommendedAction
    }: UploadDraftRequest = req.body;
    
    // Validate required fields
    if (!emailAccountId || !to || !subject || !body) {
      res.status(400).json({ 
        error: 'Missing required fields: emailAccountId, to, subject, body' 
      });
      return;
    }
    
    // Get email account details
    const accountResult = await pool.query(
      'SELECT email_address FROM email_accounts WHERE id = $1 AND user_id = $2',
      [emailAccountId, userId]
    );
    
    if (accountResult.rows.length === 0) {
      res.status(404).json({ error: 'Email account not found' });
      return;
    }
    
    const fromEmail = accountResult.rows[0].email_address;
    
    // Get user's folder preferences
    const userResult = await pool.query(
      'SELECT preferences FROM "user" WHERE id = $1',
      [userId]
    );
    const preferences = userResult.rows[0]?.preferences || {};
    const folderPrefs = preferences.folderPreferences;
    
    // Resolve destination without verifying/creating folders
    const actionRouter = new EmailActionRouter(folderPrefs);
    const routeResult = actionRouter.getActionRoute(recommendedAction || 'reply-all');
    
    // Create IMAP operations instance (we will preserve the connection for the whole request)
    const imapOps = await ImapOperations.fromAccountId(emailAccountId, userId);
    
    // Create email message
    const emailMessage = await createEmailMessage(
      fromEmail,
      to,
      subject,
      body,
      req.body.bodyHtml,
      cc,
      inReplyTo,
      references
    );
    
    // Upload to destination folder with appropriate flags (preserve connection)
    try {
      await imapOps.appendMessage(routeResult.folder, emailMessage, routeResult.flags, true);
    } catch (err: any) {
      // If folder missing or append fails, surface a clear error without creating folders here
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('append failed') || msg.toLowerCase().includes('no such mailbox') || msg.toLowerCase().includes('trycreate')) {
        res.status(400).json({ error: `Destination folder not found or unavailable: ${routeResult.folder}` });
        return;
      }
      throw err;
    } finally {
      // Release preserved connection
      imapOps.release();
    }
    
    res.json({ 
      success: true,
      message: `Email uploaded to ${routeResult.displayName}`,
      folder: routeResult.folder,
      action: recommendedAction || 'reply-all'
    });
  } catch (error) {
    console.error('Error uploading draft:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to upload draft' 
    });
  }
});

// Get list of folders for an email account
router.get('/folders/:accountId', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.params;
    
    const imapOps = await ImapOperations.fromAccountId(accountId, userId);
    const folders = await imapOps.getFolders();
    
    res.json({ folders });
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch folders' 
    });
  }
});

// Move email to folder based on action
router.post('/move-email', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const {
      emailAccountId,
      rawMessage,
      messageUid,
      sourceFolder,
      recommendedAction
    } = req.body;
    
    // Validate required fields
    if (!emailAccountId || !recommendedAction) {
      res.status(400).json({ 
        error: 'Missing required fields: emailAccountId, recommendedAction' 
      });
      return;
    }
    
    // Get user's folder preferences
    const userResult = await pool.query(
      'SELECT preferences FROM "user" WHERE id = $1',
      [userId]
    );
    const preferences = userResult.rows[0]?.preferences || {};
    const folderPrefs = preferences.folderPreferences;
    
    // Resolve destination folder and flags without checking/creating folders here
    const actionRouter = new EmailActionRouter(folderPrefs);
    const routeResult = actionRouter.getActionRoute(recommendedAction);
    
    // Create IMAP operations instance (preserve connection for the whole request)
    const imapOps = await ImapOperations.fromAccountId(emailAccountId, userId);
    
    // If we have a UID and source folder, use moveMessage to remove from inbox
    if (messageUid && sourceFolder) {
      try {
        await imapOps.moveMessage(sourceFolder, routeResult.folder, messageUid, routeResult.flags, true);
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('no such mailbox') || msg.toLowerCase().includes('append failed') || msg.toLowerCase().includes('trycreate')) {
          res.status(400).json({ error: `Destination folder not found or unavailable: ${routeResult.folder}` });
          return;
        }
        throw err;
      } finally {
        // Release preserved connection
        imapOps.release();
      }
    } else if (rawMessage) {
      // Fallback to append if we only have raw message
      try {
        await imapOps.appendMessage(routeResult.folder, rawMessage, routeResult.flags, true);
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('no such mailbox') || msg.toLowerCase().includes('append failed') || msg.toLowerCase().includes('trycreate')) {
          res.status(400).json({ error: `Destination folder not found or unavailable: ${routeResult.folder}` });
          return;
        }
        throw err;
      } finally {
        imapOps.release();
      }
    } else {
      res.status(400).json({ 
        error: 'Either messageUid/sourceFolder or rawMessage must be provided' 
      });
      return;
    }
    
    res.json({ 
      success: true,
      message: `Email moved to ${routeResult.displayName}`,
      folder: routeResult.folder,
      action: recommendedAction,
      removedFromInbox: !!(messageUid && sourceFolder)
    });
  } catch (error) {
    console.error('Error moving email:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to move email' 
    });
  }
});

export default router;
