import express from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../server';

const router = express.Router();

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

export default router;