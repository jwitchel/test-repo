import { Router } from 'express';
import { pool } from '../lib/db';
import { requireAuth } from '../middleware/auth';
import { jobSchedulerManager, SchedulerId } from '../lib/job-scheduler-manager';

const router = Router();

// Get OAuth accounts for the current user
router.get('/accounts', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT * FROM account WHERE "userId" = $1`,
      [userId]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete user account and all associated data
// All related tables have CASCADE DELETE, so deleting from "user" cleans up everything
router.delete('/me', requireAuth, async (req, res) => {
  const userId = req.user.id;

  console.log('[accounts] Deleting user account:', userId);

  // First, stop any active schedulers for this user's email accounts
  const emailAccounts = await pool.query(
    'SELECT id FROM email_accounts WHERE user_id = $1',
    [userId]
  );

  for (const account of emailAccounts.rows) {
    // Disable schedulers - use Promise.allSettled since schedulers may not exist
    await Promise.allSettled([
      jobSchedulerManager.disableScheduler(SchedulerId.CHECK_MAIL, userId, account.id),
      jobSchedulerManager.disableScheduler(SchedulerId.UPDATE_TONE, userId, account.id),
    ]);
  }

  // Delete the user - CASCADE will handle all related tables:
  // account, session, email_accounts, email_sent, email_received,
  // llm_providers, people, person_relationships, style_clusters,
  // tone_preferences, user_action_rules, user_alerts, user_relationships,
  // draft_tracking
  const result = await pool.query(
    'DELETE FROM "user" WHERE id = $1 RETURNING id',
    [userId]
  );

  if (result.rowCount === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  console.log('[accounts] Successfully deleted user:', userId);
  res.json({ success: true, message: 'Account deleted successfully' });
});

export default router;