import express from 'express';
import { requireAuth } from '../middleware/auth';
import { draftGenerator } from '../lib/email-processing/draft-generator';

const router = express.Router();

// Generate draft endpoint - thin wrapper around DraftGenerator service
router.post('/generate-draft', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { rawMessage, emailAccountId, providerId } = req.body;

    if (!rawMessage || !emailAccountId || !providerId) {
      res.status(400).json({
        error: 'Missing required fields: rawMessage, emailAccountId, providerId'
      });
      return;
    }

    const result = await draftGenerator.generateDraft({
      rawMessage,
      emailAccountId,
      providerId,
      userId
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({
        error: 'Failed to generate draft',
        message: result.error
      });
    }
  } catch (error) {
    console.error('Error generating draft:', error);
    res.status(500).json({
      error: 'Failed to generate draft',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;