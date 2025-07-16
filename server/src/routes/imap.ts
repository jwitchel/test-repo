import express from 'express';
import { requireAuth } from '../server';
import { ImapOperations } from '../lib/imap-operations';
import { ImapConnectionError } from '../lib/imap-connection';

const router = express.Router();

// Get folders for an email account
router.get('/accounts/:accountId/folders', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { accountId } = req.params;

    const imapOps = await ImapOperations.fromAccountId(accountId, userId);
    const folders = await imapOps.getFolders();

    res.json(folders);
  } catch (error: any) {
    console.error('Error fetching folders:', error);
    
    if (error.code === 'ACCOUNT_NOT_FOUND') {
      res.status(404).json({ error: 'Email account not found' });
    } else if (error instanceof ImapConnectionError) {
      res.status(503).json({ 
        error: 'IMAP connection failed',
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({ error: 'Failed to fetch folders' });
    }
  }
});

// Get messages from a folder
router.get('/accounts/:accountId/folders/:folderName/messages', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { accountId, folderName } = req.params;
    const { limit = 50, offset = 0, sort = 'date', descending = 'true' } = req.query;

    const imapOps = await ImapOperations.fromAccountId(accountId, userId);
    const messages = await imapOps.getMessages(folderName, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      sort: sort as 'date' | 'from' | 'subject',
      descending: descending === 'true'
    });

    // Update last sync time
    await imapOps.updateLastSync();

    res.json(messages);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    
    if (error.code === 'ACCOUNT_NOT_FOUND') {
      res.status(404).json({ error: 'Email account not found' });
    } else if (error instanceof ImapConnectionError) {
      res.status(503).json({ 
        error: 'IMAP connection failed',
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
});

// Search messages
router.post('/accounts/:accountId/folders/:folderName/search', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { accountId, folderName } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const criteria = req.body;

    const imapOps = await ImapOperations.fromAccountId(accountId, userId);
    const messages = await imapOps.searchMessages(folderName, criteria, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json(messages);
  } catch (error: any) {
    console.error('Error searching messages:', error);
    
    if (error.code === 'ACCOUNT_NOT_FOUND') {
      res.status(404).json({ error: 'Email account not found' });
    } else if (error instanceof ImapConnectionError) {
      res.status(503).json({ 
        error: 'IMAP connection failed',
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({ error: 'Failed to search messages' });
    }
  }
});

// Get a single message
router.get('/accounts/:accountId/folders/:folderName/messages/:uid', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { accountId, folderName, uid } = req.params;

    const imapOps = await ImapOperations.fromAccountId(accountId, userId);
    const message = await imapOps.getMessage(folderName, parseInt(uid));

    res.json(message);
  } catch (error: any) {
    console.error('Error fetching message:', error);
    
    if (error.code === 'ACCOUNT_NOT_FOUND') {
      res.status(404).json({ error: 'Email account not found' });
    } else if (error.code === 'MESSAGE_NOT_FOUND') {
      res.status(404).json({ error: 'Message not found' });
    } else if (error instanceof ImapConnectionError) {
      res.status(503).json({ 
        error: 'IMAP connection failed',
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({ error: 'Failed to fetch message' });
    }
  }
});

// Mark message as read
router.put('/accounts/:accountId/folders/:folderName/messages/:uid/read', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { accountId, folderName, uid } = req.params;

    const imapOps = await ImapOperations.fromAccountId(accountId, userId);
    await imapOps.markAsRead(folderName, parseInt(uid));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error marking message as read:', error);
    
    if (error.code === 'ACCOUNT_NOT_FOUND') {
      res.status(404).json({ error: 'Email account not found' });
    } else if (error instanceof ImapConnectionError) {
      res.status(503).json({ 
        error: 'IMAP connection failed',
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({ error: 'Failed to mark message as read' });
    }
  }
});

// Mark message as unread
router.put('/accounts/:accountId/folders/:folderName/messages/:uid/unread', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { accountId, folderName, uid } = req.params;

    const imapOps = await ImapOperations.fromAccountId(accountId, userId);
    await imapOps.markAsUnread(folderName, parseInt(uid));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error marking message as unread:', error);
    
    if (error.code === 'ACCOUNT_NOT_FOUND') {
      res.status(404).json({ error: 'Email account not found' });
    } else if (error instanceof ImapConnectionError) {
      res.status(503).json({ 
        error: 'IMAP connection failed',
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({ error: 'Failed to mark message as unread' });
    }
  }
});

// Delete message
router.delete('/accounts/:accountId/folders/:folderName/messages/:uid', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { accountId, folderName, uid } = req.params;

    const imapOps = await ImapOperations.fromAccountId(accountId, userId);
    await imapOps.deleteMessage(folderName, parseInt(uid));

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting message:', error);
    
    if (error.code === 'ACCOUNT_NOT_FOUND') {
      res.status(404).json({ error: 'Email account not found' });
    } else if (error instanceof ImapConnectionError) {
      res.status(503).json({ 
        error: 'IMAP connection failed',
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }
});

export default router;