import express from 'express';
import { requireAuth } from '../server';

const router = express.Router();

// Get current user session
router.get('/session', requireAuth, (req, res) => {
  res.json({
    user: (req as any).user,
    session: (req as any).session,
  });
});

// Additional auth endpoints can go here
// (better-auth handles the main auth routes automatically)

export default router;