import express from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../server';


const router = express.Router();

// Get user's tone profile
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    const result = await pool.query(
      'SELECT relationship_type, profile_data, emails_analyzed, last_updated FROM tone_profiles WHERE user_id = $1',
      [userId]
    );
    
    // Transform rows into object with relationship types as keys
    const profiles: any = {};
    result.rows.forEach(row => {
      profiles[row.relationship_type] = {
        ...row.profile_data,
        emails_analyzed: row.emails_analyzed,
        last_updated: row.last_updated,
      };
    });
    
    res.json({
      profiles,
      totalEmailsAnalyzed: result.rows.reduce((sum, row) => sum + row.emails_analyzed, 0),
      lastUpdated: result.rows.length > 0 
        ? Math.max(...result.rows.map(row => new Date(row.last_updated).getTime()))
        : null,
    });
  } catch (error) {
    console.error('Error fetching tone profile:', error);
    res.status(500).json({ error: 'Failed to fetch tone profile' });
  }
});

// Trigger tone profile building
router.post('/build', requireAuth, async (_req, res) => {
  try {
    // const userId = (req as any).user.id;
    
    // TODO: Queue background job for tone profile building
    // For now, just return success
    
    res.json({ 
      message: 'Tone profile building started',
      status: 'queued',
    });
  } catch (error) {
    console.error('Error starting tone profile build:', error);
    res.status(500).json({ error: 'Failed to start tone profile building' });
  }
});

export default router;