import express from 'express';
import { requireAuth } from '../middleware/auth';
import { jobSchedulerManager, SchedulerId } from '../lib/job-scheduler-manager';

const router = express.Router();

// Get all schedulers for the authenticated user
router.get('/', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const schedulers = await jobSchedulerManager.getAllSchedulerStatuses(userId);

    res.json({
      schedulers,
      total: schedulers.length
    });
  } catch (error) {
    console.error('Error getting schedulers:', error);
    res.status(500).json({
      error: 'Failed to get schedulers',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get specific scheduler status
router.get('/:id', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const schedulerId = req.params.id;

    // Validate scheduler ID
    if (!Object.values(SchedulerId).includes(schedulerId as SchedulerId)) {
      res.status(400).json({ error: `Invalid scheduler ID: ${schedulerId}` });
      return;
    }

    const status = await jobSchedulerManager.getSchedulerStatus(schedulerId, userId);
    res.json(status);
  } catch (error) {
    console.error(`Error getting scheduler ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to get scheduler',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update scheduler (enable/disable)
router.put('/:id', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const schedulerId = req.params.id;
    const { enabled } = req.body;

    // Validate scheduler ID
    if (!Object.values(SchedulerId).includes(schedulerId as SchedulerId)) {
      res.status(400).json({ error: `Invalid scheduler ID: ${schedulerId}` });
      return;
    }

    // Validate enabled parameter
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }

    if (enabled) {
      // Get the user's first email account to use for scheduling
      const accountsResponse = await fetch(`http://localhost:${process.env.PORT || 3002}/api/email-accounts`, {
        headers: {
          'Cookie': req.headers.cookie || ''
        }
      });

      if (!accountsResponse.ok) {
        res.status(400).json({ error: 'Please add an email account first' });
        return;
      }

      const accounts = await accountsResponse.json() as any[];
      if (!accounts || accounts.length === 0) {
        res.status(400).json({ error: 'Please add an email account first' });
        return;
      }

      const firstAccount = accounts[0];
      await jobSchedulerManager.enableScheduler(schedulerId, userId, firstAccount.id);
    } else {
      await jobSchedulerManager.disableScheduler(schedulerId, userId);
    }

    // Get updated status
    const status = await jobSchedulerManager.getSchedulerStatus(schedulerId, userId);

    res.json({
      success: true,
      message: `Scheduler ${schedulerId} ${enabled ? 'enabled' : 'disabled'}`,
      scheduler: status
    });
  } catch (error) {
    console.error(`Error updating scheduler ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to update scheduler',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Initialize schedulers for user (called when user logs in or app starts)
router.post('/initialize', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    await jobSchedulerManager.initializeUserSchedulers(userId);

    const schedulers = await jobSchedulerManager.getAllSchedulerStatuses(userId);

    res.json({
      success: true,
      message: 'Schedulers initialized',
      schedulers
    });
  } catch (error) {
    console.error('Error initializing schedulers:', error);
    res.status(500).json({
      error: 'Failed to initialize schedulers',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;