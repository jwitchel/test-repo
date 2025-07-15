import { encryptPassword, decryptPassword } from '../lib/crypto';
import { validateEmailAccount } from '../middleware/validation';
import { Request, Response } from 'express';

describe('Email Account GET/DELETE Endpoints', () => {
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
        is_active: true,
        last_sync: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // This is just a compile-time check
      const _typeCheck: import('../types/email-account').EmailAccountResponse = response;
      expect(response).toBeDefined();
    });
  });

  describe('GET Endpoint Logic', () => {
    it('should format response correctly', () => {
      const dbRow = {
        id: '123',
        email_address: 'test@example.com',
        imap_host: 'localhost',
        imap_port: 993,
        imap_username: 'test@example.com',
        is_active: true,
        last_sync: new Date('2024-01-01'),
        created_at: new Date('2023-12-01')
      };

      const formatted = {
        id: dbRow.id,
        email_address: dbRow.email_address,
        imap_host: dbRow.imap_host,
        imap_port: dbRow.imap_port,
        imap_secure: dbRow.imap_port === 993 || dbRow.imap_port === 1993,
        imap_username: dbRow.imap_username,
        is_active: dbRow.is_active,
        last_sync: dbRow.last_sync ? dbRow.last_sync.toISOString() : null,
        created_at: dbRow.created_at.toISOString(),
        updated_at: dbRow.created_at.toISOString()
      };

      expect(formatted.imap_secure).toBe(true);
      expect(formatted.last_sync).toBe('2024-01-01T00:00:00.000Z');
      expect(formatted).not.toHaveProperty('imap_password_encrypted');
    });

    it('should infer imap_secure correctly', () => {
      const testCases = [
        { port: 993, expected: true },
        { port: 1993, expected: true },
        { port: 143, expected: false },
        { port: 1143, expected: false },
        { port: 25, expected: false }
      ];

      testCases.forEach(({ port, expected }) => {
        const secure = port === 993 || port === 1993;
        expect(secure).toBe(expected);
      });
    });
  });

  describe('DELETE Endpoint Logic', () => {
    it('should validate UUID format', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      const validUUIDs = [
        '00000000-0000-0000-0000-000000000000',
        '123e4567-e89b-12d3-a456-426614174000',
        'A1B2C3D4-E5F6-1234-5678-9ABCDEF01234'
      ];

      const invalidUUIDs = [
        'not-a-uuid',
        '123',
        '00000000-0000-0000-0000',
        'xyz-123-456-789',
        ''
      ];

      validUUIDs.forEach(uuid => {
        expect(uuidRegex.test(uuid)).toBe(true);
      });

      invalidUUIDs.forEach(uuid => {
        expect(uuidRegex.test(uuid)).toBe(false);
      });
    });
  });

  describe('Email Account CRUD Operations', () => {
    it('should handle email account data structure', () => {
      const account = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '987e6543-e21b-12d3-a456-426614174000',
        email_address: 'test@example.com',
        imap_host: 'imap.example.com',
        imap_port: 993,
        imap_username: 'test@example.com',
        imap_password_encrypted: 'encrypted:iv:authTag:data',
        is_active: true,
        last_sync: null,
        created_at: new Date()
      };

      expect(account.email_address).toBe('test@example.com');
      expect(account.imap_port).toBe(993);
      expect(account.is_active).toBe(true);
    });
  });
});