import express from 'express';
import { requireAuth } from '../server';
import { pool } from '../server';

const router = express.Router();

// Get user's email accounts
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    const result = await pool.query(
      'SELECT id, email_address, imap_host, imap_port, is_active, last_sync, created_at FROM email_accounts WHERE user_id = $1',
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    res.status(500).json({ error: 'Failed to fetch email accounts' });
  }
});

// Add new email account
router.post('/', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { email, imapHost, imapPort, password } = req.body;
    
    // Validate required fields
    if (!email || !imapHost || !imapPort || !password) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    
    // TODO: Add IMAP connection testing here
    // TODO: Add password encryption here
    
    const result = await pool.query(
      `INSERT INTO email_accounts (user_id, email_address, imap_host, imap_port, imap_username, imap_password_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email_address, imap_host, imap_port, created_at`,
      [userId, email, imapHost, imapPort, email, 'ENCRYPTED_PASSWORD_PLACEHOLDER']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating email account:', error);
    res.status(500).json({ error: 'Failed to create email account' });
  }
});

// Delete email account
router.delete('/:id', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const accountId = req.params.id;
    
    const result = await pool.query(
      'DELETE FROM email_accounts WHERE id = $1 AND user_id = $2 RETURNING id',
      [accountId, userId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Email account not found' });
      return;
    }
    
    res.json({ message: 'Email account deleted successfully' });
  } catch (error) {
    console.error('Error deleting email account:', error);
    res.status(500).json({ error: 'Failed to delete email account' });
  }
});

export default router;