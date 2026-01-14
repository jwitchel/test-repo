/// <reference path="../types/express.d.ts" />
import express from 'express';
import { auth } from '../lib/auth';

/**
 * Protected route middleware - requires authenticated session or service token
 */
export const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
  // Check for service token first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    if (token === process.env.SERVICE_TOKEN) {
      // For service token auth, userId must be in the body
      if (!(req.body as any).userId) {
        res.status(400).json({ error: 'userId required when using service token' });
        return;
      }
      req.user = { id: (req.body as any).userId };
      req.isServiceToken = true;
      next();
      return;
    }
  }
  
  try {
    // Regular session-based auth
    
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
    req.user = session.user;
    req.session = session;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid session' });
  }
};

/**
 * Admin role middleware - must be used AFTER requireAuth
 * Blocks service tokens and non-admin users
 */
export const requireAdmin = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  // Defensive check - requireAuth must run first
  if (!req.user) {
    console.error('[SECURITY] requireAdmin called without requireAuth');
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Service tokens cannot be admins (system operations only)
  if (req.isServiceToken) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
};