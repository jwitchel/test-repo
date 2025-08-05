import { TemplateManager } from '../template-manager';
import { WritingPatterns } from '../writing-pattern-analyzer';
import * as Handlebars from 'handlebars';

describe('Writing Patterns Partial', () => {
  let templateManager: TemplateManager;

  beforeEach(async () => {
    templateManager = new TemplateManager();
    await templateManager.initialize();
  });

  it('should render writing patterns correctly', () => {
    const testPatterns: WritingPatterns = {
      sentencePatterns: {
        avgLength: 12.5,
        minLength: 2,
        maxLength: 35,
        stdDeviation: 6.2,
        distribution: {
          short: 0.30,
          medium: 0.55,
          long: 0.15
        },
        examples: ['Thanks!', 'I appreciate your help.']
      },
      paragraphPatterns: [
        { type: 'single-line', percentage: 60, description: 'Quick responses' }
      ],
      openingPatterns: [
        { pattern: 'Hi [Name],', frequency: 0.80 },
        { pattern: '[right to the point]', frequency: 0.20, notes: 'For follow-ups' }
      ],
      valediction: [
        { phrase: 'Best,', percentage: 70 },
        { phrase: '[None]', percentage: 30 }
      ],
      typedName: [
        { phrase: 'Sarah', percentage: 70 },
        { phrase: '[None]', percentage: 30 }
      ],
      negativePatterns: [
        {
          description: 'None noted',
          confidence: 0.95,
          examples: []
        }
      ],
      responsePatterns: {
        immediate: 0.65,
        contemplative: 0.35,
        questionHandling: 'acknowledge-then-answer'
      },
      uniqueExpressions: [
        { phrase: 'Happy to help', context: 'When offering assistance', frequency: 0.40 }
      ]
    };

    // Create a test template using the partial
    const template = Handlebars.compile('{{> writing-patterns patterns=patterns}}');
    const result = template({ patterns: testPatterns });

    // Verify key sections are present
    expect(result).toContain('=== WRITING PATTERN INSTRUCTIONS ===');
    expect(result).toContain('SENTENCE STRUCTURE:');
    expect(result).toContain('Average length: 12.5 words');
    expect(result).toContain('Short sentences (<10 words): 30%');
    
    // Check openings
    expect(result).toContain('OPENINGS (use exactly as shown):');
    expect(result).toContain('"Hi [Name]," (80%)');
    expect(result).toContain('"[right to the point]" (20%) - For follow-ups');
    
    // Check negative patterns
    expect(result).toContain('NEVER DO THESE THINGS:');
    expect(result).toContain('None noted');
    
    // Check response patterns
    expect(result).toContain('RESPONSE STYLE:');
    expect(result).toContain('Direct/immediate responses: 65%');
    expect(result).toContain('Question handling: acknowledge-then-answer');
    
    // Check unique expressions
    expect(result).toContain('UNIQUE PHRASES TO USE:');
    expect(result).toContain('"Happy to help" - use When offering assistance (40%)');
  });

  it('should handle empty pattern sections gracefully', () => {
    const minimalPatterns: WritingPatterns = {
      sentencePatterns: {
        avgLength: 10,
        minLength: 5,
        maxLength: 20,
        stdDeviation: 5,
        distribution: { short: 0.5, medium: 0.5, long: 0 },
        examples: []
      },
      paragraphPatterns: [],
      openingPatterns: [],
      valediction: [],
      typedName: [],
      negativePatterns: [],
      responsePatterns: {
        immediate: 1,
        contemplative: 0,
        questionHandling: 'direct'
      },
      uniqueExpressions: []
    };

    const template = Handlebars.compile('{{> writing-patterns patterns=patterns}}');
    const result = template({ patterns: minimalPatterns });

    // Should still have section headers even if empty
    expect(result).toContain('PARAGRAPH STRUCTURE:');
    expect(result).toContain('OPENINGS (use exactly as shown):');
    expect(result).toContain('CLOSINGS (use exactly as shown):');
    expect(result).toContain('NEVER DO THESE THINGS:');
    expect(result).toContain('UNIQUE PHRASES TO USE:');
    
    // Should render response patterns
    expect(result).toContain('Direct/immediate responses: 100%');
  });

  it('should properly escape special characters', () => {
    const patternsWithSpecialChars: WritingPatterns = {
      sentencePatterns: {
        avgLength: 10,
        minLength: 5,
        maxLength: 20,
        stdDeviation: 5,
        distribution: { short: 0.5, medium: 0.5, long: 0 },
        examples: []
      },
      paragraphPatterns: [],
      openingPatterns: [
        { pattern: 'Hi & hello', frequency: 0.5 }
      ],
      valediction: [],
      typedName: [],
      negativePatterns: [
        {
          description: 'None noted',
          confidence: 0.9,
          examples: []
        }
      ],
      responsePatterns: {
        immediate: 0.5,
        contemplative: 0.5,
        questionHandling: 'direct'
      },
      uniqueExpressions: [
        { phrase: 'Let\'s sync up', context: 'When scheduling', frequency: 0.2 }
      ]
    };

    const template = Handlebars.compile('{{> writing-patterns patterns=patterns}}');
    const result = template({ patterns: patternsWithSpecialChars });

    // Triple braces should prevent HTML escaping
    expect(result).toContain('None noted');
    expect(result).toContain('"Let\'s sync up"');
    expect(result).toContain('"Hi & hello"');
  });
});