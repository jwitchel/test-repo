import express from 'express';
import { auth } from '../lib/auth';

// Protected route middleware
export const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  try {
    // Create a headers object that better-auth expects
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        headers.set(key, Array.isArray(value) ? value[0] : value);
      }
    });

    const session = await auth.api.getSession({
      headers: headers,
    });

    if (!session) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Add user info to request
    (req as any).user = session.user;
    (req as any).session = session;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid session' });
  }
};