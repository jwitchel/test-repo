import { encryptPassword, decryptPassword } from '../crypto';

describe('Crypto Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Set a test encryption key
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters-long!!';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('encryptPassword', () => {
    it('should encrypt a password successfully', () => {
      const password = 'mySecretPassword123!';
      const encrypted = encryptPassword(password);
      
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(password);
      expect(encrypted.split(':')).toHaveLength(4);
    });

    it('should produce different encrypted outputs for the same password', () => {
      const password = 'samePassword123!';
      const encrypted1 = encryptPassword(password);
      const encrypted2 = encryptPassword(password);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle passwords with special characters', () => {
      const specialPasswords = [
        'pass!@#$%^&*()',
        'пароль123', // Cyrillic
        '密码123', // Chinese
        'emoji😀password',
        'tab\tand\nnewline',
        'very-long-password-'.repeat(10)
      ];

      specialPasswords.forEach(password => {
        const encrypted = encryptPassword(password);
        expect(encrypted).toBeTruthy();
        expect(encrypted.split(':')).toHaveLength(4);
      });
    });

    it('should throw error when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;
      
      expect(() => encryptPassword('password')).toThrow('ENCRYPTION_KEY environment variable is not set');
    });

    it('should throw error when ENCRYPTION_KEY is empty', () => {
      process.env.ENCRYPTION_KEY = '';
      
      expect(() => encryptPassword('password')).toThrow('ENCRYPTION_KEY environment variable is not set');
    });
  });

  describe('decryptPassword', () => {
    it('should decrypt an encrypted password successfully', () => {
      const password = 'mySecretPassword123!';
      const encrypted = encryptPassword(password);
      const decrypted = decryptPassword(encrypted);
      
      expect(decrypted).toBe(password);
    });

    it('should handle roundtrip encryption/decryption for various passwords', () => {
      const passwords = [
        'simple',
        'complex!@#$%^&*()',
        'very-long-password-that-exceeds-typical-length-limits-and-contains-numbers-123456789',
        '', // empty password
        ' ', // whitespace
        'пароль', // non-ASCII
        '🔐🔑', // emojis
      ];

      passwords.forEach(password => {
        const encrypted = encryptPassword(password);
        const decrypted = decryptPassword(encrypted);
        expect(decrypted).toBe(password);
      });
    });

    it('should throw error when ENCRYPTION_KEY is not set', () => {
      const encrypted = encryptPassword('password'); // encrypt with key
      delete process.env.ENCRYPTION_KEY;
      
      expect(() => decryptPassword(encrypted)).toThrow('ENCRYPTION_KEY environment variable is not set');
    });

    it('should throw error for invalid encrypted data format', () => {
      const invalidFormats = [
        'not-encrypted',
        'only:two:parts',
        'five:parts:is:too:many',
        '',
        'base64:base64:base64:notbase64!@#',
      ];

      invalidFormats.forEach(invalid => {
        expect(() => decryptPassword(invalid)).toThrow();
      });
    });

    it('should throw error when decrypting with wrong key', () => {
      const password = 'myPassword';
      const encrypted = encryptPassword(password);
      
      // Change the encryption key
      process.env.ENCRYPTION_KEY = 'different-encryption-key-32-chars!!!';
      
      expect(() => decryptPassword(encrypted)).toThrow('Failed to decrypt password');
    });

    it('should throw error when encrypted data is tampered', () => {
      const password = 'myPassword';
      const encrypted = encryptPassword(password);
      const parts = encrypted.split(':');
      
      // Tamper with the encrypted data
      parts[3] = Buffer.from('tampered').toString('base64');
      const tampered = parts.join(':');
      
      expect(() => decryptPassword(tampered)).toThrow('Failed to decrypt password');
    });
  });

  describe('encryption format', () => {
    it('should use the expected format: salt:iv:authTag:encrypted', () => {
      const password = 'testPassword';
      const encrypted = encryptPassword(password);
      const parts = encrypted.split(':');
      
      expect(parts).toHaveLength(4);
      
      // Verify each part is valid base64
      parts.forEach((part, index) => {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
        
        // Verify expected lengths when decoded
        const decoded = Buffer.from(part, 'base64');
        switch (index) {
          case 0: // salt
            expect(decoded.length).toBe(32);
            break;
          case 1: // iv
            expect(decoded.length).toBe(16);
            break;
          case 2: // authTag
            expect(decoded.length).toBe(16);
            break;
          case 3: // encrypted data
            expect(decoded.length).toBeGreaterThan(0);
            break;
        }
      });
    });
  });

  describe('security properties', () => {
    it('should use authenticated encryption (cannot decrypt modified ciphertext)', () => {
      const password = 'securePassword';
      const encrypted = encryptPassword(password);
      const parts = encrypted.split(':');
      
      // Try to modify auth tag
      const authTagBuffer = Buffer.from(parts[2], 'base64');
      authTagBuffer[0] = authTagBuffer[0] ^ 0xFF; // flip bits
      parts[2] = authTagBuffer.toString('base64');
      
      const modified = parts.join(':');
      expect(() => decryptPassword(modified)).toThrow('Failed to decrypt password');
    });
  });
});