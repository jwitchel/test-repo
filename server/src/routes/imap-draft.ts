import express from 'express';
import { requireAuth } from '../middleware/auth';
import { emailMover } from '../lib/email-processing/email-mover';

const router = express.Router();

// Upload draft email to IMAP folder - thin wrapper around EmailMover service
router.post('/upload-draft', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const {
      emailAccountId,
      to,
      cc,
      subject,
      body,
      bodyHtml,
      inReplyTo,
      references,
      recommendedAction
    } = req.body;

    const result = await emailMover.uploadDraft({
      emailAccountId,
      userId,
      to,
      cc,
      subject,
      body,
      bodyHtml,
      inReplyTo,
      references,
      recommendedAction
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(result.error === 'Email account not found' ? 404 : 500).json({
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error uploading draft:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to upload draft'
    });
  }
});

export default router;
