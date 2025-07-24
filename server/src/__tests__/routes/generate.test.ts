import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';

// Mock the server module to avoid circular imports and server startup
jest.mock('../../server', () => ({
  requireAuth: (req: any, res: express.Response, next: express.NextFunction) => {
    if (req.headers.cookie?.includes('test-token')) {
      req.user = { id: req.testUserId || 'test-user-' + Date.now() };
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  },
  pool: new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb'
  })
}));

// Mock the crypto module
jest.mock('../../lib/crypto', () => ({
  encryptPassword: jest.fn((password: string) => `encrypted-${password}`),
  decryptPassword: jest.fn((encrypted: string) => 'decrypted-api-key')
}));

// Mock the LLMClient
jest.mock('../../lib/llm-client', () => ({
  LLMClient: jest.fn().mockImplementation(() => ({
    generateFromPipeline: jest.fn().mockResolvedValue('This is a generated email reply based on your writing style.'),
    generate: jest.fn().mockResolvedValue('This is a generated response.'),
    getModelInfo: jest.fn().mockReturnValue({
      name: 'gpt-3.5-turbo',
      provider: 'openai',
      contextWindow: 4096,
      maxOutputTokens: 1000
    })
  }))
}));

// Import the router after mocking
import generateRouter from '../../routes/generate';

// Create a test app without starting the server
const createTestApp = (userId: string) => {
  const app = express();
  app.use(express.json());
  
  // Add test user ID to request
  app.use((req: any, res, next) => {
    req.testUserId = userId;
    next();
  });
  
  app.use('/api/generate', generateRouter);
  return app;
};

describe('Generate API', () => {
  let app: express.Application;
  let authCookie: string;
  const testUserId = 'test-user-' + Date.now();
  // Use a valid UUID format
  const testProviderId = '550e8400-e29b-41d4-a716-446655440001';
  let pool: Pool;

  beforeAll(async () => {
    app = createTestApp(testUserId);
    
    // Get the mocked pool
    const serverModule = await import('../../server');
    pool = serverModule.pool;
    
    // Create test data
    await pool.query(
      'INSERT INTO "user" (id, email, name, "emailVerified") VALUES ($1, $2, $3, $4)',
      [testUserId, `test-generate-${Date.now()}@example.com`, 'Test User', true]
    );
    
    // Create a test LLM provider
    await pool.query(
      `INSERT INTO llm_providers 
       (id, user_id, provider_name, provider_type, api_key_encrypted, model_name, is_default, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [testProviderId, testUserId, 'Test OpenAI', 'openai', 'encrypted-key', 'gpt-3.5-turbo', true, true]
    );

    authCookie = 'test-token=valid';
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM llm_providers WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM "user" WHERE id = $1', [testUserId]);
    await pool.end();
  });

  describe('POST /api/generate/email-reply', () => {
    it('should generate email reply from pipeline data', async () => {
      const pipelineData = {
        llm_prompt: 'Generate a reply to an email about a project update',
        nlp_features: {
          sentiment: { primary: 'positive', intensity: 0.8 },
          formality: 0.6
        },
        relationship: {
          type: 'colleague',
          confidence: 0.9
        },
        enhanced_profile: {
          commonPhrases: ['Thanks for the update', 'Looking forward']
        }
      };

      const response = await request(app)
        .post('/api/generate/email-reply')
        .set('Cookie', authCookie)
        .send(pipelineData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reply');
      expect(response.body).toHaveProperty('provider_id', testProviderId);
      expect(response.body).toHaveProperty('model', 'gpt-3.5-turbo');
      expect(response.body).toHaveProperty('usage');
      expect(response.body.usage).toHaveProperty('prompt_tokens');
      expect(response.body.usage).toHaveProperty('completion_tokens');
      expect(response.body.usage).toHaveProperty('total_tokens');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/generate/email-reply')
        .send({ llm_prompt: 'Test prompt' });

      expect(response.status).toBe(401);
    });

    it('should require llm_prompt', async () => {
      const response = await request(app)
        .post('/api/generate/email-reply')
        .set('Cookie', authCookie)
        .send({
          nlp_features: {},
          relationship: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('prompt is required');
    });

    it('should handle missing LLM provider', async () => {
      // Delete the provider temporarily
      await pool.query('DELETE FROM llm_providers WHERE user_id = $1', [testUserId]);

      const response = await request(app)
        .post('/api/generate/email-reply')
        .set('Cookie', authCookie)
        .send({
          llm_prompt: 'Test prompt'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('No LLM provider found');

      // Restore the provider
      await pool.query(
        `INSERT INTO llm_providers 
         (id, user_id, provider_name, provider_type, api_key_encrypted, model_name, is_default, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [testProviderId, testUserId, 'Test OpenAI', 'openai', 'encrypted-key', 'gpt-3.5-turbo', true, true]
      );
    });

    it('should use specific provider when provider_id is provided', async () => {
      const specificProviderId = '550e8400-e29b-41d4-a716-446655440002';
      
      // Create another provider
      await pool.query(
        `INSERT INTO llm_providers 
         (id, user_id, provider_name, provider_type, api_key_encrypted, model_name, is_default, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [specificProviderId, testUserId, 'Test Anthropic', 'anthropic', 'encrypted-key', 'claude-3-sonnet', false, true]
      );

      const response = await request(app)
        .post('/api/generate/email-reply')
        .set('Cookie', authCookie)
        .send({
          llm_prompt: 'Generate a reply',
          provider_id: specificProviderId,
          nlp_features: {},
          relationship: {}
        });

      expect(response.status).toBe(200);
      expect(response.body.provider_id).toBe(specificProviderId);

      // Clean up
      await pool.query('DELETE FROM llm_providers WHERE id = $1', [specificProviderId]);
    });
  });

  describe('POST /api/generate', () => {
    it('should generate generic text response', async () => {
      const response = await request(app)
        .post('/api/generate')
        .set('Cookie', authCookie)
        .send({
          prompt: 'Write a short poem about coding',
          temperature: 0.7,
          max_tokens: 100
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reply');
      expect(response.body).toHaveProperty('provider_id');
      expect(response.body).toHaveProperty('model');
      expect(response.body).toHaveProperty('usage');
    });

    it('should require prompt', async () => {
      const response = await request(app)
        .post('/api/generate')
        .set('Cookie', authCookie)
        .send({
          temperature: 0.7
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Prompt is required');
    });

    it('should handle inactive provider', async () => {
      // Make provider inactive
      await pool.query(
        'UPDATE llm_providers SET is_active = false WHERE id = $1',
        [testProviderId]
      );

      const response = await request(app)
        .post('/api/generate')
        .set('Cookie', authCookie)
        .send({
          prompt: 'Test prompt'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('No LLM provider found');

      // Restore provider
      await pool.query(
        'UPDATE llm_providers SET is_active = true WHERE id = $1',
        [testProviderId]
      );
    });
  });
});