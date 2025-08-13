import express from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../server';
import { ImapOperations } from '../lib/imap-operations';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';

const router = express.Router();

interface UploadDraftRequest {
  emailAccountId: string;
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  inReplyTo?: string;
  references?: string;
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
      references
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
    
    // Create IMAP operations instance
    const imapOps = await ImapOperations.fromAccountId(emailAccountId, userId);
    
    // Find draft folder
    let draftFolder: string;
    try {
      draftFolder = await imapOps.findDraftFolder();
    } catch (error) {
      console.error('Draft folder not found:', error);
      
      // Try once more to get all folders and log them
      const allFolders = await imapOps.getFolders();
      console.log('All available folders (including nested):', allFolders.map(f => ({
        path: f.path,
        flags: f.flags
      })));
      
      // For Gmail, try the standard Gmail drafts path
      const gmailDrafts = allFolders.find(f => 
        f.path.toLowerCase() === '[gmail]/drafts' ||
        (f.path.includes('[Gmail]') && f.path.toLowerCase().includes('draft'))
      );
      
      if (gmailDrafts) {
        console.log(`Found Gmail drafts folder: ${gmailDrafts.path}`);
        draftFolder = gmailDrafts.path;
      } else {
        // Fail - do not fallback to INBOX
        res.status(400).json({ 
          error: 'Draft folder not found. Cannot save draft email.',
          availableFolders: allFolders.map(f => f.path)
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
    
    // Upload to draft folder
    await imapOps.appendMessage(draftFolder, emailMessage, ['\\Draft']);
    
    res.json({ 
      success: true,
      message: 'Draft uploaded successfully',
      folder: draftFolder
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

export default router;