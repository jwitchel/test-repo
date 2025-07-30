import request from 'supertest';
import express from 'express';
import { setupTestDb, cleanupTestDb, closeTestPool } from '../test/db-utils';

describe('Health Check Integration', () => {
  let app: express.Express;

  beforeAll(async () => {
    await setupTestDb();
    
    // Create a minimal Express app for testing
    app = express();
    
    // Add the health check endpoint
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'healthy' });
    });
  });

  afterAll(async () => {
    await cleanupTestDb();
    await closeTestPool();
  });

  describe('GET /health', () => {
    it('should return 200 OK with healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({ status: 'healthy' });
    });

    it('should return JSON content type', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });
  });

  describe('Database Connection', () => {
    it('should connect to test database successfully', async () => {
      // This test verifies that our test database utilities work
      const { testPool } = await import('../test/db-utils');
      const result = await testPool.query('SELECT NOW() as current_time');
      
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty('current_time');
    });

    it('should have all required tables', async () => {
      const { testPool } = await import('../test/db-utils');
      
      // Check for better-auth tables
      const userTableResult = await testPool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'user'
        );
      `);
      
      const sessionTableResult = await testPool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'session'
        );
      `);
      
      // Check for custom tables
      const emailAccountsResult = await testPool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'email_accounts'
        );
      `);
      
      expect(userTableResult.rows[0].exists).toBe(true);
      expect(sessionTableResult.rows[0].exists).toBe(true);
      expect(emailAccountsResult.rows[0].exists).toBe(true);
    });
  });
});

