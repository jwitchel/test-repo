import { Request, Response, NextFunction } from 'express';
import { CreateEmailAccountRequest, EmailAccountValidationError } from '../types/email-account';

export function validateEmailAccount(req: Request, res: Response, next: NextFunction): void {
  try {
    const body = req.body as CreateEmailAccountRequest;
    
    // Check required fields
    if (!body.email_address) {
      throw new EmailAccountValidationError('email_address', 'Email address is required');
    }
    
    if (!body.imap_host) {
      throw new EmailAccountValidationError('imap_host', 'IMAP host is required');
    }
    
    if (body.imap_port === undefined || body.imap_port === null) {
      throw new EmailAccountValidationError('imap_port', 'IMAP port is required');
    }
    
    if (body.imap_secure === undefined || body.imap_secure === null) {
      throw new EmailAccountValidationError('imap_secure', 'IMAP secure flag is required');
    }
    
    if (!body.imap_username) {
      throw new EmailAccountValidationError('imap_username', 'IMAP username is required');
    }
    
    if (!body.imap_password) {
      throw new EmailAccountValidationError('imap_password', 'IMAP password is required');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email_address)) {
      throw new EmailAccountValidationError('email_address', 'Invalid email address format');
    }
    
    // Validate port range
    const port = Number(body.imap_port);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new EmailAccountValidationError('imap_port', 'IMAP port must be between 1 and 65535');
    }
    
    // Validate boolean
    if (typeof body.imap_secure !== 'boolean') {
      throw new EmailAccountValidationError('imap_secure', 'IMAP secure must be a boolean');
    }
    
    // Validate host format (basic check)
    if (body.imap_host.length < 3 || body.imap_host.includes(' ')) {
      throw new EmailAccountValidationError('imap_host', 'Invalid IMAP host format');
    }
    
    // Sanitize and normalize data
    req.body = {
      email_address: body.email_address.toLowerCase().trim(),
      imap_host: body.imap_host.trim(),
      imap_port: port,
      imap_secure: body.imap_secure,
      imap_username: body.imap_username.trim(),
      imap_password: body.imap_password // Don't trim passwords
    };
    
    next();
  } catch (error) {
    if (error instanceof EmailAccountValidationError) {
      res.status(400).json({
        error: 'Validation error',
        field: error.field,
        message: error.message
      });
      return;
    }
    
    res.status(400).json({
      error: 'Invalid request body'
    });
  }
}