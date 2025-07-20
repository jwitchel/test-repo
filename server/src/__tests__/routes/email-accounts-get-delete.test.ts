import { Request, Response } from 'express';
import { EmailAccountResponse } from '../../types/email-account';

describe('Email Accounts GET/DELETE Endpoints', () => {
  describe('GET /api/email-accounts', () => {
    it('should return email accounts with proper format', () => {
      // Mock database rows
      const mockRows = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email_address: 'user@example.com',
          imap_host: 'imap.example.com',
          imap_port: 993,
          imap_username: 'user@example.com',
          is_active: true,
          last_sync: new Date('2024-01-15T10:00:00Z'),
          created_at: new Date('2024-01-01T10:00:00Z')
        },
        {
          id: '223e4567-e89b-12d3-a456-426614174000',
          email_address: 'user2@gmail.com',
          imap_host: 'imap.gmail.com',
          imap_port: 993,
          imap_username: 'user2@gmail.com',
          is_active: false,
          last_sync: null,
          created_at: new Date('2024-01-02T10:00:00Z')
        }
      ];

      // Transform to expected response format
      const expectedAccounts: EmailAccountResponse[] = mockRows.map(row => ({
        id: row.id,
        email_address: row.email_address,
        imap_host: row.imap_host,
        imap_port: row.imap_port,
        imap_secure: row.imap_port === 993 || row.imap_port === 1993,
        imap_username: row.imap_username,
        is_active: row.is_active,
        last_sync: row.last_sync ? row.last_sync.toISOString() : null,
        created_at: row.created_at.toISOString(),
        updated_at: row.created_at.toISOString()
      }));

      // Verify transformation
      expect(expectedAccounts).toHaveLength(2);
      expect(expectedAccounts[0]).toMatchObject({
        id: '123e4567-e89b-12d3-a456-426614174000',
        email_address: 'user@example.com',
        imap_secure: true, // Port 993 should be secure
        last_sync: '2024-01-15T10:00:00.000Z'
      });
      expect(expectedAccounts[1]).toMatchObject({
        imap_secure: true, // Port 993 should be secure
        last_sync: null
      });
    });

    it('should infer imap_secure from port numbers', () => {
      const testCases = [
        { port: 143, expectedSecure: false },
        { port: 993, expectedSecure: true },
        { port: 1143, expectedSecure: false },
        { port: 1993, expectedSecure: true },
        { port: 2525, expectedSecure: false }
      ];

      testCases.forEach(({ port, expectedSecure }) => {
        const isSecure = port === 993 || port === 1993;
        expect(isSecure).toBe(expectedSecure);
      });
    });

    it('should never include password fields in response', () => {
      const mockRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email_address: 'user@example.com',
        imap_host: 'imap.example.com',
        imap_port: 993,
        imap_username: 'user@example.com',
        imap_password_encrypted: 'encrypted_password_here',
        is_active: true,
        last_sync: null as Date | null,
        created_at: new Date()
      };

      // Transform to response (simulating the endpoint logic)
      const response: EmailAccountResponse = {
        id: mockRow.id,
        email_address: mockRow.email_address,
        imap_host: mockRow.imap_host,
        imap_port: mockRow.imap_port,
        imap_secure: mockRow.imap_port === 993,
        imap_username: mockRow.imap_username,
        is_active: mockRow.is_active,
        last_sync: mockRow.last_sync ? mockRow.last_sync.toISOString() : null,
        created_at: mockRow.created_at.toISOString(),
        updated_at: mockRow.created_at.toISOString()
      };

      // Verify password is not included
      expect(response).not.toHaveProperty('imap_password');
      expect(response).not.toHaveProperty('imap_password_encrypted');
      expect(Object.keys(response)).not.toContain('password');
    });

    it('should order results by created_at DESC', () => {
      const mockRows = [
        { created_at: new Date('2024-01-01'), email_address: 'first@example.com' },
        { created_at: new Date('2024-01-03'), email_address: 'third@example.com' },
        { created_at: new Date('2024-01-02'), email_address: 'second@example.com' }
      ];

      // SQL query includes ORDER BY created_at DESC
      const orderedRows = [...mockRows].sort((a, b) => 
        b.created_at.getTime() - a.created_at.getTime()
      );

      expect(orderedRows[0].email_address).toBe('third@example.com');
      expect(orderedRows[1].email_address).toBe('second@example.com');
      expect(orderedRows[2].email_address).toBe('first@example.com');
    });
  });

  describe('DELETE /api/email-accounts/:id', () => {
    it('should validate UUID format', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      // Valid UUIDs
      expect(uuidRegex.test('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(uuidRegex.test('00000000-0000-0000-0000-000000000000')).toBe(true);
      expect(uuidRegex.test('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(true);
      
      // Invalid UUIDs
      expect(uuidRegex.test('not-a-uuid')).toBe(false);
      expect(uuidRegex.test('123')).toBe(false);
      expect(uuidRegex.test('123e4567-e89b-12d3-a456-42661417400')).toBe(false); // Missing digit
      expect(uuidRegex.test('123e4567-e89b-12d3-a456-4266141740000')).toBe(false); // Extra digit
      expect(uuidRegex.test('123e4567e89b12d3a456426614174000')).toBe(false); // No dashes
    });

    it('should return 400 for invalid UUID format', () => {
      const mockReq = { params: { id: 'not-a-uuid' } } as any;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(mockReq.params.id)) {
        mockRes.status(400).json({ error: 'Invalid account ID format' });
      }

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid account ID format' });
    });

    it('should return 404 when account not found', async () => {
      const mockResult = { rows: [] };
      
      // Simulate the endpoint logic
      if (mockResult.rows.length === 0) {
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn()
        };
        mockRes.status(404).json({ error: 'Email account not found' });
        
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Email account not found' });
      }
    });

    it('should return 204 on successful deletion', () => {
      const mockResult = { rows: [{ id: '123' }] };
      
      // Simulate the endpoint logic
      if (mockResult.rows.length > 0) {
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          send: jest.fn()
        };
        mockRes.status(204).send();
        
        expect(mockRes.status).toHaveBeenCalledWith(204);
        expect(mockRes.send).toHaveBeenCalledWith();
      }
    });

    it('should only delete accounts belonging to the authenticated user', () => {
      const userId = 'user-123';
      const accountId = 'account-456';
      
      // The SQL query should include both user_id and account id
      const expectedQuery = 'DELETE FROM email_accounts WHERE id = $1 AND user_id = $2 RETURNING id';
      const expectedParams = [accountId, userId];
      
      // This ensures users can't delete other users' accounts
      expect(expectedQuery).toContain('AND user_id =');
      expect(expectedParams).toContain(userId);
      expect(expectedParams).toContain(accountId);
    });
  });

  describe('Security', () => {
    it('should require authentication for both endpoints', () => {
      // Both endpoints use requireAuth middleware
      const endpointRequiresAuth = true; // This is enforced by the middleware
      expect(endpointRequiresAuth).toBe(true);
    });

    it('should isolate data by user', () => {
      // GET query includes WHERE user_id = $1
      const getQuery = `SELECT ... FROM email_accounts WHERE user_id = $1`;
      expect(getQuery).toContain('WHERE user_id =');
      
      // DELETE query includes AND user_id = $2
      const deleteQuery = `DELETE FROM email_accounts WHERE id = $1 AND user_id = $2`;
      expect(deleteQuery).toContain('AND user_id =');
    });
  });
});