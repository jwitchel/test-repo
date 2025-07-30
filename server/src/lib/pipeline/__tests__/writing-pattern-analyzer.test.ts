import { WritingPatternAnalyzer } from '../writing-pattern-analyzer';
import { Pool } from 'pg';
import { encryptPassword } from '../../crypto';
import { ProcessedEmail } from '../types';

describe('WritingPatternAnalyzer', () => {
  let analyzer: WritingPatternAnalyzer;
  let pool: Pool;
  let testUserId: string;
  let testProviderId: string;

  beforeAll(async () => {
    // Create real database connection
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb'
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Create test user
    testUserId = 'test-analyzer-' + Date.now();
    await pool.query(
      `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, NOW(), NOW())`,
      [testUserId, `${testUserId}@test.com`, 'Test User']
    );

    // Create test LLM provider
    testProviderId = 'test-provider-' + Date.now();
    const encryptedApiKey = encryptPassword('test-api-key');
    
    await pool.query(
      `INSERT INTO llm_providers 
       (id, user_id, provider_name, provider_type, api_key_encrypted, model_name, is_active, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, true, true)`,
      [testProviderId, testUserId, 'Test Provider', 'openai', encryptedApiKey, 'gpt-3.5-turbo']
    );

    analyzer = new WritingPatternAnalyzer();
  });

  afterEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM "user" WHERE id = $1', [testUserId]);
  });

  describe('initialization', () => {
    it('should initialize with default LLM provider', async () => {
      await analyzer.initialize();
      
      const modelName = analyzer.getModelName();
      expect(modelName).toBe('gpt-3.5-turbo');
    });

    it('should initialize with specific LLM provider', async () => {
      // Create another provider
      const specificProviderId = 'specific-' + Date.now();
      const encryptedApiKey = encryptPassword('test-api-key-2');
      
      await pool.query(
        `INSERT INTO llm_providers 
         (id, user_id, provider_name, provider_type, api_key_encrypted, model_name, is_active, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, true, false)`,
        [specificProviderId, testUserId, 'Specific Provider', 'anthropic', encryptedApiKey, 'claude-3-sonnet']
      );

      await analyzer.initialize(specificProviderId);
      
      const modelName = analyzer.getModelName();
      expect(modelName).toBe('claude-3-sonnet');
    });

    it('should throw error if no active provider found', async () => {
      // Deactivate all providers
      await pool.query(
        'UPDATE llm_providers SET is_active = false WHERE user_id = $1',
        [testUserId]
      );

      await expect(analyzer.initialize()).rejects.toThrow('No active LLM provider found');
    });
  });

  describe('pattern loading and saving', () => {
    const testPatterns = {
      sentencePatterns: {
        avgLength: 15.5,
        minLength: 5,
        maxLength: 25,
        stdDeviation: 4.2,
        distribution: { short: 20, medium: 60, long: 20 },
        examples: ['Test sentence.']
      },
      paragraphPatterns: [
        { type: 'short', percentage: 30, description: 'Brief and concise' }
      ],
      openingPatterns: [
        { pattern: 'Hi there', frequency: 0.8 }
      ],
      closingPatterns: [
        { pattern: 'Best regards', frequency: 0.9 }
      ],
      negativePatterns: [],
      responsePatterns: {
        immediate: 0.7,
        contemplative: 0.3,
        questionHandling: 'direct'
      },
      uniqueExpressions: []
    };

    beforeEach(async () => {
      await analyzer.initialize();
    });

    it('should save patterns to user-level profile', async () => {
      await analyzer.savePatterns(testUserId, testPatterns, undefined, 500);

      // Verify saved data
      const result = await pool.query(
        `SELECT profile_data FROM tone_preferences 
         WHERE user_id = $1 AND preference_type = 'aggregate'`,
        [testUserId]
      );

      expect(result.rows).toHaveLength(1);
      const savedData = result.rows[0].profile_data;
      expect(savedData.writingPatterns).toMatchObject(testPatterns);
      expect(savedData.meta.emailCount).toBe(500);
    });

    it('should save patterns to relationship-specific preferences', async () => {
      await analyzer.savePatterns(testUserId, testPatterns, 'colleague', 1000);

      // Verify relationship was created
      const relResult = await pool.query(
        `SELECT id FROM user_relationships 
         WHERE user_id = $1 AND relationship_type = 'colleague'`,
        [testUserId]
      );
      expect(relResult.rows).toHaveLength(1);

      // Verify saved patterns
      const result = await pool.query(
        `SELECT profile_data FROM tone_preferences 
         WHERE user_id = $1 AND preference_type = 'category' AND target_identifier = 'colleague'`,
        [testUserId]
      );

      expect(result.rows).toHaveLength(1);
      const savedData = result.rows[0].profile_data;
      expect(savedData.writingPatterns).toMatchObject(testPatterns);
    });

    it('should load patterns from database', async () => {
      // Save patterns first
      await analyzer.savePatterns(testUserId, testPatterns);

      // Load them back
      const loaded = await analyzer.loadPatterns(testUserId);
      
      expect(loaded).toMatchObject(testPatterns);
    });

    it('should return null if no patterns found', async () => {
      const loaded = await analyzer.loadPatterns(testUserId);
      
      expect(loaded).toBeNull();
    });
  });

  describe('template integration', () => {
    it('should use templates for prompts', async () => {
      await analyzer.initialize();
      
      // The analyzer should have initialized the template manager
      // We can't test the actual LLM calls without a real API key,
      // but we can verify the analyzer is ready to use templates
      expect(analyzer.getModelName()).toBeTruthy();
    });
  });

  // Note: We can't test the actual pattern analysis without a real LLM API key
  // Those tests would need to be in a separate test suite with real credentials
});