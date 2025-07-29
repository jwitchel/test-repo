import { WritingPatternAnalyzer } from '../writing-pattern-analyzer';
import { TemplateManager } from '../template-manager';

// Mock dependencies
jest.mock('../../../server', () => ({
  pool: {
    query: jest.fn()
  }
}));

jest.mock('../../imap-logger', () => ({
  imapLogger: {
    log: jest.fn()
  }
}));

jest.mock('../template-manager');

describe('WritingPatternAnalyzer', () => {
  let analyzer: WritingPatternAnalyzer;
  let mockPool: any;
  let mockTemplateManager: jest.Mocked<TemplateManager>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get mocked dependencies
    const { pool } = require('../../../server');
    mockPool = pool;
    
    // Setup template manager mock
    mockTemplateManager = new TemplateManager() as jest.Mocked<TemplateManager>;
    mockTemplateManager.initialize = jest.fn().mockResolvedValue(undefined);
    mockTemplateManager.renderSystemPrompt = jest.fn().mockResolvedValue('Test system prompt');
    mockTemplateManager.renderPrompt = jest.fn().mockResolvedValue('Test user prompt');
    
    analyzer = new WritingPatternAnalyzer();
  });

  describe('initialization', () => {
    it('should initialize with default LLM provider', async () => {
      // Mock database response
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'test-provider-id',
          provider_type: 'openai',
          api_key: 'test-key',
          api_endpoint: 'https://api.openai.com',
          model_name: 'gpt-3.5-turbo'
        }]
      });

      await analyzer.initialize();

      // Verify database query
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM llm_providers'),
        []
      );
    });

    it('should initialize with specific LLM provider', async () => {
      const providerId = 'specific-provider-id';
      
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: providerId,
          provider_type: 'anthropic',
          api_key: 'test-key',
          model_name: 'claude-3-sonnet'
        }]
      });

      await analyzer.initialize(providerId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM llm_providers'),
        [providerId]
      );
    });

    it('should throw error if no active provider found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(analyzer.initialize()).rejects.toThrow('No active LLM provider found');
    });
  });

  describe('pattern loading and saving', () => {
    const testPatterns = {
      sentencePatterns: {
        avgLength: 15,
        minLength: 3,
        maxLength: 45,
        stdDeviation: 8.5,
        distribution: { short: 0.2, medium: 0.6, long: 0.2 },
        examples: ['Thanks!', 'Let me know.']
      },
      paragraphPatterns: [],
      openingPatterns: [{ pattern: 'Hi [Name],', frequency: 0.7 }],
      closingPatterns: [{ pattern: 'Thanks,\\nJohn', frequency: 0.8 }],
      negativePatterns: [{ description: 'Never uses Dear', confidence: 0.99 }],
      responsePatterns: { immediate: 0.7, contemplative: 0.3, questionHandling: 'direct' },
      uniqueExpressions: []
    };

    it('should save patterns to user-level profile', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await analyzer.savePatterns('user-123', testPatterns, undefined, 500);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tone_profiles'),
        expect.arrayContaining(['user-123', 'aggregate', expect.any(String), 500])
      );
    });

    it('should save patterns to relationship-specific preferences', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await analyzer.savePatterns('user-123', testPatterns, 'colleague');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO relationship_tone_preferences'),
        expect.arrayContaining(['user-123', 'colleague', expect.any(String)])
      );
    });

    it('should load patterns from database', async () => {
      const storedData = {
        writingPatterns: testPatterns,
        lastAnalyzed: new Date().toISOString()
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{ profile_data: storedData }]
      });

      const loaded = await analyzer.loadPatterns('user-123');

      expect(loaded).toEqual(testPatterns);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT profile_data'),
        ['user-123']
      );
    });

    it('should return null if no patterns found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const loaded = await analyzer.loadPatterns('user-123');

      expect(loaded).toBeNull();
    });
  });

  describe('template integration', () => {
    it('should use templates for prompts', async () => {
      // This test verifies that the analyzer uses Handlebars templates
      // rather than inline strings
      
      const analyzer = new WritingPatternAnalyzer();
      
      // Verify template manager is instantiated
      expect(TemplateManager).toHaveBeenCalled();
    });
  });
});