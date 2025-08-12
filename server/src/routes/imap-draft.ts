import express from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../server';
import { ImapOperations } from '../lib/imap-operations';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

interface UploadDraftRequest {
  emailAccountId: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}

// Helper function to create RFC2822 formatted email
function createEmailMessage(
  from: string,
  to: string,
  subject: string,
  body: string,
  inReplyTo?: string,
  references?: string
): string {
  const messageId = `<${uuidv4()}@ai-email-assistant>`;
  const date = new Date().toUTCString();
  
  let headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable'
  ];
  
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
  }
  
  if (references) {
    headers.push(`References: ${references}`);
  }
  
  // Join headers with CRLF and add body
  const message = headers.join('\r\n') + '\r\n\r\n' + body;
  
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
    const emailMessage = createEmailMessage(
      fromEmail,
      to,
      subject,
      body,
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