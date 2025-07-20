import { TemplateManager } from '../template-manager';
import { SelectedExample } from '../example-selector';
import path from 'path';

describe('TemplateManager', () => {
  let templateManager: TemplateManager;
  
  beforeEach(() => {
    const templateDir = path.join(__dirname, '..', 'templates');
    templateManager = new TemplateManager(templateDir);
  });

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      await expect(templateManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('template loading', () => {
    it('should load prompt templates', async () => {
      await templateManager.initialize();
      const template = await templateManager.loadTemplate('default', 'prompt');
      expect(template).toBeDefined();
      expect(typeof template).toBe('function');
    });

    it('should load system templates', async () => {
      await templateManager.initialize();
      const template = await templateManager.loadTemplate('default', 'system');
      expect(template).toBeDefined();
      expect(typeof template).toBe('function');
    });

    it('should throw error for non-existent template', async () => {
      await templateManager.initialize();
      await expect(templateManager.loadTemplate('non-existent', 'prompt'))
        .rejects.toThrow('Failed to load template non-existent');
    });
  });

  describe('template rendering', () => {
    const mockData = {
      recipientEmail: 'test@example.com',
      relationship: 'friend',
      incomingEmail: 'How are you doing?',
      exactExamples: [
        {
          text: 'Hey! I am doing great, thanks for asking!',
          relationship: 'friend',
          wordCount: 8,
          formalityScore: 0.2
        }
      ],
      meta: {
        exampleCount: 1,
        relationshipMatchCount: 1,
        avgWordCount: 8,
        formalityLevel: 'casual'
      }
    };

    it('should render default prompt template', async () => {
      await templateManager.initialize();
      const result = await templateManager.renderPrompt('default', mockData);
      
      expect(result).toContain('test@example.com');
      expect(result).toContain('friend');
      expect(result).toContain('How are you doing?');
      expect(result).toContain('Hey! I am doing great');
    });

    it('should render verbose prompt template', async () => {
      await templateManager.initialize();
      const result = await templateManager.renderPrompt('verbose', mockData);
      
      expect(result).toContain('RELATIONSHIP TYPE: friend');
      expect(result).toContain('Average word count: 8 words');
      expect(result).toContain('Formality level: casual');
    });

    it('should render system prompt', async () => {
      await templateManager.initialize();
      const result = await templateManager.renderSystemPrompt();
      
      expect(result).toContain('AI assistant');
      expect(result).toContain('personal writing style');
      expect(result).toContain('Key guidelines');
    });
  });

  describe('helper functions', () => {
    it('should truncate text correctly', async () => {
      await templateManager.initialize();
      const template = await templateManager.loadTemplate('default', 'prompt');
      
      const data = {
        ...mockData,
        exactExamples: [{
          text: 'This is a very long text that should be truncated because it exceeds the maximum length allowed by the template truncation helper function. We need to add more text here to make sure it actually exceeds 200 characters so the truncation will happen and we can see the ellipsis at the end.',
          relationship: 'friend'
        }]
      };
      
      const result = template(data);
      expect(result).toContain('...');
      expect(result).not.toContain('ellipsis at the end');
    });

    it('should handle missing data gracefully', async () => {
      await templateManager.initialize();
      const template = await templateManager.loadTemplate('default', 'prompt');
      
      const minimalData = {
        recipientEmail: 'test@example.com',
        relationship: 'colleague',
        incomingEmail: 'Meeting tomorrow?',
        meta: {
          exampleCount: 0,
          relationshipMatchCount: 0,
          avgWordCount: 0,
          formalityLevel: 'neutral'
        }
      };
      
      const result = template(minimalData);
      expect(result).toContain('test@example.com');
      expect(result).toContain('Meeting tomorrow?');
      expect(result).not.toContain('Example 1');
    });
  });

  describe('formatExamplesForTemplate', () => {
    it('should format SelectedExample array correctly', () => {
      const examples: SelectedExample[] = [
        {
          id: '1',
          text: 'Hello there!',
          score: 0.9,
          metadata: {
            relationship: { type: 'friend', confidence: 0.9, detectionMethod: 'auto' },
            features: {
              stats: { formalityScore: 0.3, wordCount: 2 },
              sentiment: { dominant: 'positive' },
              urgency: { level: 'low' }
            },
            wordCount: 2,
            subject: 'Greeting'
          }
        }
      ];
      
      const formatted = templateManager.formatExamplesForTemplate(examples);
      
      expect(formatted).toHaveLength(1);
      expect(formatted[0]).toEqual({
        text: 'Hello there!',
        relationship: 'friend',
        subject: 'Greeting',
        formalityScore: 0.3,
        sentiment: 'positive',
        wordCount: 2,
        urgency: 'low',
        keyPhrases: []
      });
    });
  });

  describe('prepareTemplateData', () => {
    it('should prepare data with exact and other matches', () => {
      const examples: SelectedExample[] = [
        {
          id: '1',
          text: 'Hey friend!',
          score: 0.95,
          metadata: {
            relationship: { type: 'friend', confidence: 0.9, detectionMethod: 'auto' },
            features: {
              stats: { formalityScore: 0.2, wordCount: 2 }
            },
            wordCount: 2
          }
        },
        {
          id: '2',
          text: 'Hello colleague',
          score: 0.8,
          metadata: {
            relationship: { type: 'colleague', confidence: 0.85, detectionMethod: 'auto' },
            features: {
              stats: { formalityScore: 0.7, wordCount: 2 }
            },
            wordCount: 2
          }
        }
      ];
      
      const data = templateManager.prepareTemplateData({
        incomingEmail: 'Test email',
        recipientEmail: 'test@example.com',
        relationship: 'friend',
        examples,
        relationshipProfile: {
          typicalFormality: 'casual',
          commonGreetings: ['Hey', 'Hi'],
          commonClosings: ['Cheers', 'Thanks'],
          useEmojis: true,
          useHumor: true
        }
      });
      
      expect(data.exactExamples).toHaveLength(1);
      expect(data.otherExamples).toHaveLength(1);
      expect(data.meta.relationshipMatchCount).toBe(1);
      expect(data.meta.avgWordCount).toBe(2);
      expect(data.profile).toBeDefined();
    });
  });
});

const mockData = {
  recipientEmail: 'test@example.com',
  relationship: 'friend',
  incomingEmail: 'How are you doing?',
  exactExamples: [
    {
      text: 'Hey! I am doing great, thanks for asking!',
      relationship: 'friend',
      wordCount: 8,
      formalityScore: 0.2
    }
  ],
  meta: {
    exampleCount: 1,
    relationshipMatchCount: 1,
    avgWordCount: 8,
    formalityLevel: 'casual'
  }
};