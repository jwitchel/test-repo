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
    
    // Create action router with user's preferences
    const actionRouter = new EmailActionRouter(folderPrefs);
    
    // Get the destination folder based on recommended action
    const routeResult = actionRouter.getActionRoute(recommendedAction || 'reply');
    
    // Create IMAP operations instance
    const imapOps = await ImapOperations.fromAccountId(emailAccountId, userId);
    
    // Check if the destination folder exists
    const folderStatus = await actionRouter.checkFolders(imapOps);
    
    if (folderStatus.missing.includes(routeResult.folder)) {
      // Try to create the missing folders
      const createResult = await actionRouter.createMissingFolders(imapOps);
      
      if (createResult.failed.some(f => f.folder === routeResult.folder)) {
        res.status(400).json({ 
          error: `Failed to create destination folder: ${routeResult.folder}`,
          missingFolders: folderStatus.missing,
          failedToCreate: createResult.failed
        });
        return;
      }
    }
    
    // Create email message
    const emailMessage = await createEmailMessage(
      fromEmail,
      to,
      subject,
      body,
      req.body.bodyHtml,
      inReplyTo,
      references
    );
    
    // Upload to destination folder with appropriate flags
    await imapOps.appendMessage(routeResult.folder, emailMessage, routeResult.flags);
    
    res.json({ 
      success: true,
      message: `Email uploaded to ${routeResult.displayName}`,
      folder: routeResult.folder,
      action: recommendedAction || 'reply'
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
      recommendedAction
    } = req.body;
    
    // Validate required fields
    if (!emailAccountId || !rawMessage || !recommendedAction) {
      res.status(400).json({ 
        error: 'Missing required fields: emailAccountId, rawMessage, recommendedAction' 
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
    
    // Create action router with user's preferences
    const actionRouter = new EmailActionRouter(folderPrefs);
    
    // Get the destination folder based on recommended action
    const routeResult = actionRouter.getActionRoute(recommendedAction);
    
    // Create IMAP operations instance
    const imapOps = await ImapOperations.fromAccountId(emailAccountId, userId);
    
    // Check if the destination folder exists
    const folderStatus = await actionRouter.checkFolders(imapOps);
    
    if (folderStatus.missing.includes(routeResult.folder)) {
      // Try to create the missing folders
      const createResult = await actionRouter.createMissingFolders(imapOps);
      
      if (createResult.failed.some(f => f.folder === routeResult.folder)) {
        res.status(400).json({ 
          error: `Failed to create destination folder: ${routeResult.folder}`,
          missingFolders: folderStatus.missing,
          failedToCreate: createResult.failed
        });
        return;
      }
    }
    
    // Upload the original message to destination folder with appropriate flags
    await imapOps.appendMessage(routeResult.folder, rawMessage, routeResult.flags);
    
    res.json({ 
      success: true,
      message: `Email moved to ${routeResult.displayName}`,
      folder: routeResult.folder,
      action: recommendedAction
    });
  } catch (error) {
    console.error('Error moving email:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to move email' 
    });
  }
});

export default router;