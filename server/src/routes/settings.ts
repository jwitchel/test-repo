import express from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../server';

const router = express.Router();

// Get typed name preferences
router.get('/typed-name', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    const result = await pool.query(
      `SELECT profile_data->'typedNamePreferences' as preferences
       FROM tone_preferences
       WHERE user_id = $1 
         AND preference_type = 'user'
         AND target_identifier = 'global'`,
      [userId]
    );
    
    if (!result.rows.length || !result.rows[0].preferences) {
      // Return empty preferences if none exist
      return res.json({
        preferences: {
          removalRegex: '',
          appendString: ''
        }
      });
    }
    
    return res.json({
      preferences: result.rows[0].preferences
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
    
    // Check if user preferences exist
    const existingResult = await pool.query(
      `SELECT id FROM tone_preferences
       WHERE user_id = $1 
         AND preference_type = 'user'
         AND target_identifier = 'global'`,
      [userId]
    );
    
    if (existingResult.rows.length > 0) {
      // Update existing preferences
      await pool.query(
        `UPDATE tone_preferences
         SET profile_data = jsonb_set(
           COALESCE(profile_data, '{}'),
           '{typedNamePreferences}',
           $1::jsonb,
           true
         ),
         updated_at = NOW()
         WHERE user_id = $2 
           AND preference_type = 'user'
           AND target_identifier = 'global'`,
        [JSON.stringify(preferences), userId]
      );
    } else {
      // Create new preferences record
      await pool.query(
        `INSERT INTO tone_preferences 
         (user_id, preference_type, target_identifier, profile_data, emails_analyzed, last_updated)
         VALUES ($1, 'user', 'global', $2, 0, NOW())`,
        [userId, JSON.stringify({ typedNamePreferences: preferences })]
      );
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error saving typed name preferences:', error);
    return res.status(500).json({ error: 'Failed to save preferences' });
  }
});

export default router;