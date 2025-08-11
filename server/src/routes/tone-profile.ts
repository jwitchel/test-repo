import express from 'express';
import { requireAuth } from '../middleware/auth';
import { pool } from '../server';


const router = express.Router();

// Get user's tone profile
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    const result = await pool.query(
      'SELECT preference_type, target_identifier, profile_data, emails_analyzed, last_updated FROM tone_preferences WHERE user_id = $1',
      [userId]
    );
    
    // Transform rows into object with target identifiers as keys
    const profiles: any = {};
    result.rows.forEach(row => {
      // Always return a consistent structure with writingPatterns at the root
      const writingPatterns = row.profile_data.writingPatterns || {};
      
      profiles[row.target_identifier] = {
        // Writing pattern fields at root level
        sentencePatterns: writingPatterns.sentencePatterns || null,
        paragraphPatterns: writingPatterns.paragraphPatterns || [],
        openingPatterns: writingPatterns.openingPatterns || [],
        valediction: writingPatterns.valediction || [],
        typedName: writingPatterns.typedName || [],
        negativePatterns: writingPatterns.negativePatterns || [],
        responsePatterns: writingPatterns.responsePatterns || null,
        uniqueExpressions: writingPatterns.uniqueExpressions || [],
        
        // Metadata fields
        meta: {
          ...(row.profile_data.meta || {}),
          // Include sentence stats metadata if available
          sentenceStats: row.profile_data.sentenceStats ? {
            lastCalculated: row.profile_data.sentenceStats.lastCalculated,
            totalSentences: row.profile_data.sentenceStats.totalSentences,
            calculationMethod: 'direct' // Indicate this was calculated directly, not by LLM
          } : null
        },
        emails_analyzed: row.emails_analyzed,
        last_updated: row.last_updated,
        preference_type: row.preference_type
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