import { SelectedExample } from './example-selector';
import { RelationshipProfile } from './types';

export interface PromptFormatterParams {
  incomingEmail: string;
  recipientEmail: string;
  relationship: string;
  examples: SelectedExample[];
  relationshipProfile?: RelationshipProfile | null;
}

export interface FormattedPrompt {
  prompt: string;
  metadata: {
    exampleCount: number;
    relationshipExampleCount: number;
    otherRelationshipCount: number;
    hasRelationshipProfile: boolean;
  };
}

export class PromptFormatter {
  private readonly maxExampleLength = 200;
  private readonly maxOtherRelationshipExamples = 5;

  formatWithExamples(params: PromptFormatterParams): string {
    // Group examples by exact relationship match
    const exactMatches = params.examples.filter(e => 
      e.metadata.relationship.type === params.relationship
    );
    const otherMatches = params.examples.filter(e => 
      e.metadata.relationship.type !== params.relationship
    );
    
    // Format examples with relationship context
    const formatExamples = (examples: SelectedExample[], header: string) => {
      if (examples.length === 0) return '';
      
      return `${header}\n${examples.map((ex, i) => `
Example ${i + 1} (${ex.metadata.relationship.type}):
"${ex.text.substring(0, this.maxExampleLength)}${ex.text.length > this.maxExampleLength ? '...' : ''}"
`).join('\n')}`;
    };
    
    const exactExampleText = formatExamples(
      exactMatches, 
      `Examples of your emails to ${params.relationship}:`
    );
    
    const otherExampleText = otherMatches.length > 0 ? 
      formatExamples(
        otherMatches.slice(0, this.maxOtherRelationshipExamples), 
        '\nAdditional context from similar relationships:'
      ) : '';
    
    const exampleText = exactExampleText + otherExampleText;
    
    // Add relationship-specific guidance
    const relationshipContext = params.relationshipProfile ? `

Relationship context for ${params.relationship}:
- Typical formality: ${params.relationshipProfile.typicalFormality}
- Common greetings: ${params.relationshipProfile.commonGreetings.join(', ')}
- Common closings: ${params.relationshipProfile.commonClosings.join(', ')}
- Use emojis: ${params.relationshipProfile.useEmojis ? 'yes' : 'no'}
- Use humor: ${params.relationshipProfile.useHumor ? 'yes' : 'no'}
` : '';
    
    return `You are writing an email response to ${params.recipientEmail} (relationship: ${params.relationship}).${relationshipContext}

Based on these examples of your writing style:

${exampleText}

Please respond to:
"${params.incomingEmail}"

Important: Match the tone and style shown in the examples for this relationship type.`;
  }

  formatWithExamplesStructured(params: PromptFormatterParams): FormattedPrompt {
    const prompt = this.formatWithExamples(params);
    
    const exactMatches = params.examples.filter(e => 
      e.metadata.relationship.type === params.relationship
    );
    const otherMatches = params.examples.filter(e => 
      e.metadata.relationship.type !== params.relationship
    );

    return {
      prompt,
      metadata: {
        exampleCount: params.examples.length,
        relationshipExampleCount: exactMatches.length,
        otherRelationshipCount: otherMatches.length,
        hasRelationshipProfile: !!params.relationshipProfile
      }
    };
  }

  /**
   * Format a system prompt that explains the tone matching task
   */
  formatSystemPrompt(): string {
    return `You are an AI assistant that helps users write email responses in their personal writing style. 
You will be given examples of how the user writes to different types of relationships (spouse, family, friends, colleagues, etc.) 
and you should match their tone, formality level, typical phrases, and overall style when composing responses.

Key guidelines:
- Pay close attention to the relationship type and match the appropriate level of formality
- Use similar greetings and closings as shown in the examples
- Match the typical email length for this relationship
- Incorporate common phrases and expressions the user uses
- Maintain the same level of enthusiasm and emotion as demonstrated
- If emojis are used in examples for this relationship, use them appropriately
- Keep responses natural and authentic to the user's voice`;
  }

  /**
   * Format examples in a structured way for better LLM understanding
   */
  formatExamplesAsConversation(examples: SelectedExample[]): string {
    return examples.map((ex, i) => {
      const metadata = ex.metadata;
      const relationship = metadata.relationship?.type || 'unknown';
      const formality = metadata.features?.stats?.formalityScore || 0.5;
      const sentiment = metadata.features?.sentiment?.dominant || 'neutral';
      
      return `Example ${i + 1}:
Relationship: ${relationship}
Formality: ${this.describeFormalityLevel(formality)}
Sentiment: ${sentiment}
Original context: ${metadata.subject || 'General conversation'}
User's response: "${ex.text}"`;
    }).join('\n\n');
  }

  /**
   * Create a concise prompt for quick responses
   */
  formatMinimalPrompt(params: {
    incomingEmail: string;
    recipientEmail: string;
    relationship: string;
    topExamples: SelectedExample[];
  }): string {
    const examples = params.topExamples.slice(0, 3);
    const exampleText = examples.map(ex => `- "${ex.text}"`).join('\n');

    return `Reply to "${params.incomingEmail}" in the style of these examples:
${exampleText}
Keep the same tone and formality level.`;
  }

  /**
   * Format a prompt that emphasizes specific style characteristics
   */
  formatStyleFocusedPrompt(params: PromptFormatterParams & {
    styleEmphasis?: {
      formality?: boolean;
      brevity?: boolean;
      emotion?: boolean;
      professionalPhrases?: boolean;
    };
  }): string {
    const basePrompt = this.formatWithExamples(params);
    
    if (!params.styleEmphasis) return basePrompt;

    const emphasisPoints: string[] = [];
    
    if (params.styleEmphasis.formality) {
      const avgFormality = this.calculateAverageFormality(params.examples);
      emphasisPoints.push(`Maintain ${this.describeFormalityLevel(avgFormality)} tone throughout`);
    }
    
    if (params.styleEmphasis.brevity) {
      const avgLength = this.calculateAverageLength(params.examples);
      emphasisPoints.push(`Keep response around ${avgLength} words`);
    }
    
    if (params.styleEmphasis.emotion) {
      const emotionalMarkers = this.extractEmotionalMarkers(params.examples);
      if (emotionalMarkers.length > 0) {
        emphasisPoints.push(`Include emotional expressions like: ${emotionalMarkers.join(', ')}`);
      }
    }
    
    if (params.styleEmphasis.professionalPhrases) {
      const professionalPhrases = this.extractProfessionalPhrases(params.examples);
      if (professionalPhrases.length > 0) {
        emphasisPoints.push(`Use professional phrases like: ${professionalPhrases.join(', ')}`);
      }
    }

    const emphasisText = emphasisPoints.length > 0 ? 
      `\n\nStyle emphasis:\n${emphasisPoints.map(p => `- ${p}`).join('\n')}` : '';

    return basePrompt + emphasisText;
  }

  private describeFormalityLevel(score: number): string {
    if (score >= 0.8) return 'very formal';
    if (score >= 0.6) return 'formal';
    if (score >= 0.4) return 'neutral';
    if (score >= 0.2) return 'casual';
    return 'very casual';
  }

  private calculateAverageFormality(examples: SelectedExample[]): number {
    const scores = examples
      .map(ex => ex.metadata.features?.stats?.formalityScore)
      .filter((score): score is number => score !== undefined);
    
    if (scores.length === 0) return 0.5;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  private calculateAverageLength(examples: SelectedExample[]): number {
    const lengths = examples.map(ex => ex.metadata.wordCount || ex.text.split(/\s+/).length);
    return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  }

  private extractEmotionalMarkers(examples: SelectedExample[]): string[] {
    const markers = new Set<string>();
    const emotionalPhrases = [
      'love', 'miss', 'excited', 'happy', 'sorry', 'worried',
      'can\'t wait', 'looking forward', 'hope', 'wish'
    ];
    
    examples.forEach(ex => {
      const lowerText = ex.text.toLowerCase();
      emotionalPhrases.forEach(phrase => {
        if (lowerText.includes(phrase)) {
          markers.add(phrase);
        }
      });
    });
    
    return Array.from(markers).slice(0, 5);
  }

  private extractProfessionalPhrases(examples: SelectedExample[]): string[] {
    const phrases = new Set<string>();
    const professionalPhrases = [
      'per our discussion', 'as requested', 'please find attached',
      'for your review', 'kindly', 'regarding', 'following up',
      'please let me know', 'thank you for', 'I appreciate'
    ];
    
    examples.forEach(ex => {
      const lowerText = ex.text.toLowerCase();
      professionalPhrases.forEach(phrase => {
        if (lowerText.includes(phrase)) {
          phrases.add(phrase);
        }
      });
    });
    
    return Array.from(phrases).slice(0, 5);
  }
}