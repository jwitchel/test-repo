import { encryptPassword, decryptPassword } from '../../lib/crypto';
import { validateEmailAccount } from '../../middleware/validation';
import { Request, Response } from 'express';

describe('Email Account Components', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters-long!!';
  });

  describe('Password Encryption', () => {
    it('should encrypt and decrypt IMAP passwords', () => {
      const password = 'testpass123';
      const encrypted = encryptPassword(password);
      
      expect(encrypted).not.toBe(password);
      expect(encrypted.split(':')).toHaveLength(4);
      
      const decrypted = decryptPassword(encrypted);
      expect(decrypted).toBe(password);
    });

    it('should create unique encryptions', () => {
      const password = 'testpass123';
      const encrypted1 = encryptPassword(password);
      const encrypted2 = encryptPassword(password);
      
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('Validation Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: jest.Mock;

    beforeEach(() => {
      mockReq = { body: {} };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      mockNext = jest.fn();
    });

    it('should validate all required fields', () => {
      mockReq.body = {
        email_address: 'test@example.com',
        imap_host: 'localhost',
        imap_port: 1143,
        imap_secure: false,
        imap_username: 'test@example.com',
        imap_password: 'password'
      };

      validateEmailAccount(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject invalid email format', () => {
      mockReq.body = {
        email_address: 'not-an-email',
        imap_host: 'localhost',
        imap_port: 1143,
        imap_secure: false,
        imap_username: 'test',
        imap_password: 'password'
      };

      validateEmailAccount(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation error',
        field: 'email_address',
        message: 'Invalid email address format'
      });
    });

    it('should reject invalid port', () => {
      mockReq.body = {
        email_address: 'test@example.com',
        imap_host: 'localhost',
        imap_port: 99999,
        imap_secure: false,
        imap_username: 'test',
        imap_password: 'password'
      };

      validateEmailAccount(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation error',
        field: 'imap_port',
        message: 'IMAP port must be between 1 and 65535'
      });
    });

    it('should normalize email to lowercase', () => {
      mockReq.body = {
        email_address: 'TEST@EXAMPLE.COM',
        imap_host: 'localhost',
        imap_port: 1143,
        imap_secure: false,
        imap_username: 'TEST@EXAMPLE.COM',
        imap_password: 'password'
      };

      validateEmailAccount(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body.email_address).toBe('test@example.com');
    });
  });

  describe('Type Definitions', () => {
    it('should have correct EmailAccountResponse type', () => {
      const response = {
        id: '123',
        email_address: 'test@example.com',
        imap_host: 'localhost',
        imap_port: 1143,
        imap_secure: false,
        imap_username: 'test@example.com',
        last_sync: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // This is just a compile-time check
      const _typeCheck: import('../../types/email-account').EmailAccountResponse = response;
      expect(response).toBeDefined();
    });
  });
});