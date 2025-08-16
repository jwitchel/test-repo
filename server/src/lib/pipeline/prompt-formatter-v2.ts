import { SelectedExample } from './example-selector';
import { TemplateManager, EnhancedRelationshipProfile } from './template-manager';
import { WritingPatterns } from './writing-pattern-analyzer';

export interface PromptFormatterParams {
  incomingEmail: string;
  recipientEmail: string;
  relationship: string;
  examples: SelectedExample[];
  relationshipProfile?: EnhancedRelationshipProfile | null;
  nlpFeatures?: any; // NLP features from the incoming email
  writingPatterns?: WritingPatterns | null;
  userNames?: {
    name: string;
    nicknames?: string;
  };
  incomingEmailMetadata?: {
    from: { address: string; name?: string }[];
    to: { address: string; name?: string }[];
    cc?: { address: string; name?: string }[];
    subject: string;
    date: Date;
  };
}

export interface FormattedPrompt {
  prompt: string;
  metadata: {
    exampleCount: number;
    relationshipExampleCount: number;
    otherRelationshipCount: number;
    hasRelationshipProfile: boolean;
    templateUsed: string;
  };
}

export class PromptFormatterV2 {
  private templateManager: TemplateManager;
  private defaultTemplate: string;
  private initialized = false;

  constructor(options?: {
    templateDir?: string;
    defaultTemplate?: string;
  }) {
    this.templateManager = new TemplateManager(options?.templateDir);
    this.defaultTemplate = options?.defaultTemplate || process.env.PROMPT_TEMPLATE || 'default-json';
  }

  async initialize() {
    if (!this.initialized) {
      await this.templateManager.initialize();
      this.initialized = true;
    }
  }

  async formatWithExamples(params: PromptFormatterParams): Promise<string> {
    await this.initialize();
    
    const templateData = this.templateManager.prepareTemplateData(params);
    return this.templateManager.renderPrompt(this.defaultTemplate, templateData);
  }

  async formatWithExamplesStructured(
    params: PromptFormatterParams,
    templateName?: string
  ): Promise<FormattedPrompt> {
    await this.initialize();
    
    const template = templateName || this.defaultTemplate;
    const templateData = this.templateManager.prepareTemplateData(params);
    const prompt = await this.templateManager.renderPrompt(template, templateData);
    
    const exactMatches = params.examples.filter(e => 
      e.metadata.relationship?.type === params.relationship
    );
    const otherMatches = params.examples.filter(e => 
      e.metadata.relationship?.type !== params.relationship
    );

    return {
      prompt,
      metadata: {
        exampleCount: params.examples.length,
        relationshipExampleCount: exactMatches.length,
        otherRelationshipCount: otherMatches.length,
        hasRelationshipProfile: !!params.relationshipProfile,
        templateUsed: template
      }
    };
  }

  async formatSystemPrompt(data?: any): Promise<string> {
    await this.initialize();
    return this.templateManager.renderSystemPrompt('default', data);
  }

  // Convenience methods for specific templates
  async formatVerbosePrompt(params: PromptFormatterParams): Promise<string> {
    await this.initialize();
    const templateData = this.templateManager.prepareTemplateData(params);
    return this.templateManager.renderPrompt('verbose', templateData);
  }

  // Get available templates
  getAvailableTemplates(): string[] {
    // In a real implementation, this would scan the template directory
    return ['default', 'verbose'];
  }
}