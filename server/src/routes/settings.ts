import express from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../server';
import { EmailActionRouter } from '../lib/email-action-router';
import { ImapOperations } from '../lib/imap-operations';

const router = express.Router();

// Get profile preferences
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    const result = await pool.query(
      `SELECT name, preferences
       FROM "user"
       WHERE id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const preferences = user.preferences || {};
    
    return res.json({
      preferences: {
        name: preferences.name || user.name || '',
        nicknames: preferences.nicknames || ''
      }
    });
  } catch (error) {
    console.error('Error fetching profile preferences:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update profile preferences
router.post('/profile', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { name, nicknames, signatureBlock, folderPreferences } = req.body;
    
    // Update preferences JSONB with new profile data
    const result = await pool.query(
      `UPDATE "user" 
       SET preferences = jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(
               COALESCE(preferences, '{}'::jsonb),
               '{name}',
               $2::jsonb
             ),
             '{nicknames}',
             $3::jsonb
           ),
           '{signatureBlock}',
           $4::jsonb
         ),
         '{folderPreferences}',
         $5::jsonb
       )
       WHERE id = $1
       RETURNING preferences`,
      [userId, JSON.stringify(name), JSON.stringify(nicknames), JSON.stringify(signatureBlock), JSON.stringify(folderPreferences || {})]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.json({ 
      success: true,
      preferences: result.rows[0].preferences
    });
  } catch (error) {
    console.error('Error updating profile preferences:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get typed name preferences
router.get('/typed-name', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    const result = await pool.query(
      `SELECT preferences->'typedName' as typed_name_prefs
       FROM "user"
       WHERE id = $1`,
      [userId]
    );
    
    if (!result.rows.length || !result.rows[0].typed_name_prefs) {
      // Return empty preferences if none exist
      return res.json({
        preferences: {
          removalRegex: '',
          appendString: ''
        }
      });
    }
    
    return res.json({
      preferences: result.rows[0].typed_name_prefs
    });
  } catch (error) {
    console.error('Error fetching typed name preferences:', error);
    return res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Save typed name preferences
router.post('/typed-name', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { preferences } = req.body;
    
    // Validate preferences
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences' });
    }
    
    // Validate regex if provided
    if (preferences.removalRegex) {
      try {
        new RegExp(preferences.removalRegex);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid regular expression' });
      }
    }
    
    // Update user preferences
    await pool.query(
      `UPDATE "user"
       SET preferences = jsonb_set(
         COALESCE(preferences, '{}'),
         '{typedName}',
         $1::jsonb,
         true
       ),
       "updatedAt" = NOW()
       WHERE id = $2`,
      [JSON.stringify(preferences), userId]
    );
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error saving typed name preferences:', error);
    return res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// Test and create email folders
router.post('/test-folders', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { emailAccountId } = req.body;
    
    if (!emailAccountId) {
      res.status(400).json({ error: 'Email account ID required' });
      return;
    }
    
    // Get user's folder preferences
    const userResult = await pool.query(
      'SELECT preferences FROM "user" WHERE id = $1',
      [userId]
    );
    
    const preferences = userResult.rows[0]?.preferences || {};
    const folderPrefs = preferences.folderPreferences;
    
    // Create router with user's preferences
    const router = new EmailActionRouter(folderPrefs);
    
    // Get IMAP operations
    const imapOps = await ImapOperations.fromAccountId(emailAccountId, userId);
    
    try {
      // Check which folders exist
      const folderStatus = await router.checkFolders(imapOps);
      
      res.json({
        success: true,
        requiredFolders: router.getRequiredFolders(),
        existing: folderStatus.existing,
        missing: folderStatus.missing
      });
    } finally {
      imapOps.release();
    }
  } catch (error) {
    console.error('Error testing folders:', error);
    res.status(500).json({ 
      error: 'Failed to test folders',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

// Create missing folders
router.post('/create-folders', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { emailAccountId } = req.body;
    
    if (!emailAccountId) {
      res.status(400).json({ error: 'Email account ID required' });
      return;
    }
    
    // Get user's folder preferences
    const userResult = await pool.query(
      'SELECT preferences FROM "user" WHERE id = $1',
      [userId]
    );
    
    const preferences = userResult.rows[0]?.preferences || {};
    const folderPrefs = preferences.folderPreferences;
    
    // Create router with user's preferences
    const router = new EmailActionRouter(folderPrefs);
    
    // Get IMAP operations
    const imapOps = await ImapOperations.fromAccountId(emailAccountId, userId);
    
    try {
      // Create missing folders
      const result = await router.createMissingFolders(imapOps);
      
      res.json({
        success: true,
        created: result.created,
        failed: result.failed
      });
    } finally {
      imapOps.release();
    }
  } catch (error) {
    console.error('Error creating folders:', error);
    res.status(500).json({ 
      error: 'Failed to create folders',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

export default router;