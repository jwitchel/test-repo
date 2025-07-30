import { generateText, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { LLMProviderConfig, LLMProviderError, LLMProviderType } from '../types/llm-provider';

export interface PipelineOutput {
  llmPrompt: string;
  nlpFeatures: any;
  relationship: {
    type: string;
    confidence: number;
  };
  enhancedProfile: any;
}

export class LLMClient {
  private model: any;
  private modelName: string;

  constructor(config: LLMProviderConfig) {
    this.model = this.createModel(config);
    this.modelName = config.modelName;
  }

  private createModel(config: LLMProviderConfig): any {
    switch (config.type) {
      case 'openai': {
        const openai = createOpenAI({
          apiKey: config.apiKey,
          baseURL: this.normalizeBaseURL(config.apiEndpoint, 'https://api.openai.com/v1')
        });
        return openai(config.modelName);
      }
      
      case 'anthropic': {
        const anthropic = createAnthropic({
          apiKey: config.apiKey,
          baseURL: this.normalizeBaseURL(config.apiEndpoint, 'https://api.anthropic.com')
        });
        return anthropic(config.modelName);
      }
      
      case 'google': {
        const google = createGoogleGenerativeAI({
          apiKey: config.apiKey,
          baseURL: this.normalizeBaseURL(config.apiEndpoint, 'https://generativelanguage.googleapis.com/v1beta')
        });
        return google(config.modelName);
      }
      
      case 'local': {
        // Use OpenAI-compatible provider for Ollama
        const ollama = createOpenAICompatible({
          baseURL: config.apiEndpoint || 'http://localhost:11434/v1',
          apiKey: 'ollama', // Ollama doesn't need a real API key
          name: 'ollama'
        });
        return ollama(config.modelName);
      }
      
      default:
        throw new LLMProviderError(
          `Unsupported provider type: ${config.type}`,
          'UNKNOWN'
        );
    }
  }

  private normalizeBaseURL(endpoint: string | undefined, defaultURL: string): string | undefined {
    if (!endpoint) {
      // Use SDK default by returning undefined
      return undefined;
    }
    
    // If it's already a full URL, use it as-is
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    
    // If it's just a path, append it to the default URL
    if (endpoint.startsWith('/')) {
      const base = defaultURL.endsWith('/') ? defaultURL.slice(0, -1) : defaultURL;
      return base + endpoint;
    }
    
    // Otherwise, assume it's a full URL without protocol
    return 'https://' + endpoint;
  }

  /**
   * Main method for pipeline integration - accepts pipeline output directly
   */
  async generateFromPipeline(pipelineOutput: PipelineOutput): Promise<string> {
    // Use the pre-generated prompt from the pipeline
    const temperature = this.getTemperatureForRelationship(pipelineOutput.relationship.type);
    
    try {
      const { text } = await generateText({
        model: this.model,
        prompt: pipelineOutput.llmPrompt,
        temperature,
        maxTokens: 1000,
      });
      
      return text;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate with streaming support
   */
  async generateStream(prompt: string, options?: {
    temperature?: number;
    maxTokens?: number;
    onToken?: (token: string) => void;
  }) {
    try {
      const result = await streamText({
        model: this.model,
        prompt,
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 1000,
      });

      // Return the stream for consumption
      return result;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Generic generation method for direct API calls
   */
  async generate(prompt: string, options?: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }): Promise<string> {
    try {
      const messages = options?.systemPrompt 
        ? [
            { role: 'system' as const, content: options.systemPrompt },
            { role: 'user' as const, content: prompt }
          ]
        : prompt;

      const { text } = await generateText({
        model: this.model,
        messages: typeof messages === 'string' ? undefined : messages,
        prompt: typeof messages === 'string' ? messages : undefined,
        temperature: options?.temperature ?? 0.7,
        maxTokens: options?.maxTokens ?? 1000,
      });
      
      return text;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Test the provider connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.generate('Say "test"', { maxTokens: 5 });
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get model information
   */
  getModelInfo() {
    // Model info based on provider and model name
    const modelInfo: Record<string, { contextWindow: number; maxOutput: number }> = {
      // OpenAI
      'gpt-4-turbo-preview': { contextWindow: 128000, maxOutput: 4096 },
      'gpt-4-turbo': { contextWindow: 128000, maxOutput: 4096 },
      'gpt-4': { contextWindow: 8192, maxOutput: 4096 },
      'gpt-3.5-turbo': { contextWindow: 16384, maxOutput: 4096 },
      // Anthropic
      'claude-3-opus-20240229': { contextWindow: 200000, maxOutput: 4096 },
      'claude-3-sonnet-20240229': { contextWindow: 200000, maxOutput: 4096 },
      'claude-3-haiku-20240307': { contextWindow: 200000, maxOutput: 4096 },
      'claude-3-5-sonnet-20241022': { contextWindow: 200000, maxOutput: 8192 },
      // Google
      'gemini-1.5-pro': { contextWindow: 1048576, maxOutput: 8192 },
      'gemini-1.5-flash': { contextWindow: 1048576, maxOutput: 8192 },
      'gemini-pro': { contextWindow: 30720, maxOutput: 2048 },
      // Default for unknown models
      'default': { contextWindow: 4096, maxOutput: 2048 }
    };

    const info = modelInfo[this.modelName] || modelInfo['default'];
    
    return {
      name: this.modelName,
      ...info
    };
  }

  /**
   * Helper to adjust temperature based on relationship type
   */
  private getTemperatureForRelationship(relationshipType: string): number {
    const temperatureMap: Record<string, number> = {
      'spouse': 0.8,      // More creative for personal
      'family': 0.7,
      'friend': 0.7,
      'colleague': 0.5,   // More consistent for professional
      'manager': 0.4,
      'client': 0.3,      // Most conservative for clients
      'unknown': 0.5
    };

    return temperatureMap[relationshipType] || 0.5;
  }

  /**
   * Handle errors from Vercel AI SDK
   */
  private handleError(error: any): Error {
    // The Vercel AI SDK throws specific error types
    if (error.message?.includes('API key')) {
      throw new LLMProviderError('Invalid API key', 'INVALID_API_KEY');
    } else if (error.message?.includes('rate limit') || error.status === 429) {
      throw new LLMProviderError('Rate limit exceeded', 'RATE_LIMIT');
    } else if (error.message?.includes('model') && error.message?.includes('not found')) {
      throw new LLMProviderError('Model not found', 'MODEL_NOT_FOUND');
    } else if (error.message?.includes('connection') || error.code === 'ECONNREFUSED') {
      throw new LLMProviderError('Connection failed', 'CONNECTION_FAILED');
    } else {
      throw new LLMProviderError(
        error.message || 'Unknown error occurred',
        'UNKNOWN'
      );
    }
  }

  /**
   * Static method to detect provider type from API key format
   */
  static detectProviderType(apiKey: string): LLMProviderType | null {
    if (apiKey.startsWith('sk-ant-')) {
      return 'anthropic';
    } else if (apiKey.startsWith('sk-')) {
      return 'openai';
    } else if (apiKey.includes('AIza')) {
      return 'google';
    }
    return null;
  }

  /**
   * Get available models for a provider type
   */
  static getAvailableModels(providerType: LLMProviderType): string[] {
    const models: Record<LLMProviderType, string[]> = {
      'openai': [
        'gpt-4-turbo-preview',
        'gpt-4-turbo', 
        'gpt-4',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k'
      ],
      'anthropic': [
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      ],
      'google': [
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-pro'
      ],
      'local': [
        'llama3.2',
        'llama3.1',
        'llama3',
        'llama2',
        'mistral',
        'mixtral',
        'codellama',
        'qwen2.5-coder'
      ]
    };
    
    return models[providerType] || [];
  }
}