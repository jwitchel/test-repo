import express from 'express';
import { requireAuth } from '../middleware/auth';
import { workerManager } from '../lib/worker-manager';

const router = express.Router();

// Get worker status
router.get('/status', requireAuth, async (_req, res): Promise<void> => {
  try {
    const status = await workerManager.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting worker status:', error);
    res.status(500).json({
      error: 'Failed to get worker status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Pause all workers
router.post('/pause', requireAuth, async (_req, res): Promise<void> => {
  try {
    await workerManager.pauseAllWorkers(false); // false = wait for active jobs to complete
    const status = await workerManager.getStatus();
    res.json({
      success: true,
      message: 'All workers paused',
      status
    });
  } catch (error) {
    console.error('Error pausing workers:', error);
    res.status(500).json({
      error: 'Failed to pause workers',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Resume all workers
router.post('/resume', requireAuth, async (_req, res): Promise<void> => {
  try {
    await workerManager.resumeAllWorkers();
    const status = await workerManager.getStatus();
    res.json({
      success: true,
      message: 'All workers resumed',
      status
    });
  } catch (error) {
    console.error('Error resuming workers:', error);
    res.status(500).json({
      error: 'Failed to resume workers',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Toggle workers
router.post('/toggle', requireAuth, async (_req, res): Promise<void> => {
  try {
    const isActive = await workerManager.toggleWorkers();
    const status = await workerManager.getStatus();
    res.json({
      success: true,
      active: isActive,
      message: isActive ? 'Workers resumed' : 'Workers paused',
      status
    });
  } catch (error) {
    console.error('Error toggling workers:', error);
    res.status(500).json({
      error: 'Failed to toggle workers',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Emergency pause all queues
router.post('/emergency-pause', requireAuth, async (_req, res): Promise<void> => {
  try {
    await workerManager.emergencyPauseQueues();
    const status = await workerManager.getStatus();
    res.json({
      success: true,
      message: 'EMERGENCY: All queues paused immediately',
      status
    });
  } catch (error) {
    console.error('Error emergency pausing queues:', error);
    res.status(500).json({
      error: 'Failed to emergency pause queues',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Resume queues after emergency pause
router.post('/resume-queues', requireAuth, async (_req, res): Promise<void> => {
  try {
    await workerManager.resumeQueues();
    const status = await workerManager.getStatus();
    res.json({
      success: true,
      message: 'All queues resumed',
      status
    });
  } catch (error) {
    console.error('Error resuming queues:', error);
    res.status(500).json({
      error: 'Failed to resume queues',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Enable dry-run mode (matches pause/resume pattern)
router.post('/dry-run/enable', requireAuth, async (_req, res): Promise<void> => {
  try {
    await workerManager.enableDryRun();
    const status = await workerManager.getStatus();
    res.json({
      success: true,
      message: 'Dry-run mode enabled',
      dryRunEnabled: true,
      status
    });
  } catch (error) {
    console.error('Error enabling dry-run:', error);
    res.status(500).json({
      error: 'Failed to enable dry-run mode',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Disable dry-run mode (matches pause/resume pattern)
router.post('/dry-run/disable', requireAuth, async (_req, res): Promise<void> => {
  try {
    await workerManager.disableDryRun();
    const status = await workerManager.getStatus();
    res.json({
      success: true,
      message: 'Dry-run mode disabled',
      dryRunEnabled: false,
      status
    });
  } catch (error) {
    console.error('Error disabling dry-run:', error);
    res.status(500).json({
      error: 'Failed to disable dry-run mode',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;