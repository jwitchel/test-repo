import express from 'express';
import { requireAuth } from '../server';
import { pool } from '../server';
import { decryptPassword } from '../lib/crypto';
import { 
  LLMGenerateRequest,
  LLMGenerateFromPipelineRequest,
  LLMGenerateResponse,
  LLMProviderConfig 
} from '../types/llm-provider';
import { LLMClient, PipelineOutput } from '../lib/llm-client';

const router = express.Router();

// Helper to get provider config
async function getProviderConfig(userId: string, providerId?: string): Promise<LLMProviderConfig | null> {
  let query: string;
  let params: any[];
  
  if (providerId) {
    // Get specific provider
    query = `
      SELECT id, provider_type, api_key_encrypted, api_endpoint, model_name
      FROM llm_providers
      WHERE user_id = $1 AND id = $2 AND is_active = true
    `;
    params = [userId, providerId];
  } else {
    // Get default provider
    query = `
      SELECT id, provider_type, api_key_encrypted, api_endpoint, model_name
      FROM llm_providers
      WHERE user_id = $1 AND is_default = true AND is_active = true
      LIMIT 1
    `;
    params = [userId];
  }
  
  const result = await pool.query(query, params);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const provider = result.rows[0];
  
  return {
    id: provider.id,
    type: provider.provider_type,
    apiKey: decryptPassword(provider.api_key_encrypted),
    apiEndpoint: provider.api_endpoint,
    modelName: provider.model_name
  };
}

// Generate email reply from pipeline output
router.post('/email-reply', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const data = req.body as LLMGenerateFromPipelineRequest;
    
    // Validate request
    if (!data.llm_prompt || data.llm_prompt.trim().length === 0) {
      res.status(400).json({ error: 'LLM prompt is required' });
      return;
    }
    
    // Get provider config
    const providerConfig = await getProviderConfig(userId, data.provider_id);
    
    if (!providerConfig) {
      res.status(404).json({ 
        error: 'No LLM provider found',
        message: data.provider_id 
          ? 'The specified provider was not found or is inactive'
          : 'No default provider configured. Please add an LLM provider in settings.'
      });
      return;
    }
    
    // Create LLM client
    const client = new LLMClient(providerConfig);
    
    // Prepare pipeline output
    const pipelineOutput: PipelineOutput = {
      llmPrompt: data.llm_prompt,
      nlpFeatures: data.nlp_features,
      relationship: data.relationship,
      enhancedProfile: data.enhanced_profile
    };
    
    // Generate reply using pipeline context
    const reply = await client.generateFromPipeline(pipelineOutput);
    
    // Get model info for response
    const modelInfo = client.getModelInfo();
    
    const response: LLMGenerateResponse = {
      reply,
      provider_id: providerConfig.id,
      model: modelInfo.name,
      // Note: Real token usage would come from provider response
      // This is a rough estimate based on typical tokenization
      usage: {
        prompt_tokens: Math.ceil(data.llm_prompt.length / 4),
        completion_tokens: Math.ceil(reply.length / 4),
        total_tokens: Math.ceil((data.llm_prompt.length + reply.length) / 4)
      }
    };
    
    res.json(response);
  } catch (error: any) {
    console.error('Error generating email reply:', error);
    
    if (error.code === 'INVALID_API_KEY') {
      res.status(401).json({ 
        error: 'Invalid API key',
        message: 'The API key for this provider is invalid. Please update it in settings.'
      });
    } else if (error.code === 'RATE_LIMIT') {
      res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.'
      });
    } else if (error.code === 'MODEL_NOT_FOUND') {
      res.status(404).json({ 
        error: 'Model not found',
        message: 'The configured model is not available. Please update your provider settings.'
      });
    } else {
      res.status(500).json({ 
        error: 'Generation failed',
        message: 'An error occurred while generating the reply. Please try again.'
      });
    }
  }
});

// Generic generation endpoint (for testing or direct use)
router.post('/', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const data = req.body as LLMGenerateRequest;
    
    // Validate request
    if (!data.prompt || data.prompt.trim().length === 0) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }
    
    // Get provider config
    const providerConfig = await getProviderConfig(userId, data.provider_id);
    
    if (!providerConfig) {
      res.status(404).json({ 
        error: 'No LLM provider found',
        message: data.provider_id 
          ? 'The specified provider was not found or is inactive'
          : 'No default provider configured. Please add an LLM provider in settings.'
      });
      return;
    }
    
    // Create LLM client
    const client = new LLMClient(providerConfig);
    
    // Generate response
    const reply = await client.generate(data.prompt, {
      temperature: data.temperature,
      maxTokens: data.max_tokens
    });
    
    // Get model info for response
    const modelInfo = client.getModelInfo();
    
    const response: LLMGenerateResponse = {
      reply,
      provider_id: providerConfig.id,
      model: modelInfo.name,
      usage: {
        prompt_tokens: Math.ceil(data.prompt.length / 4),
        completion_tokens: Math.ceil(reply.length / 4),
        total_tokens: Math.ceil((data.prompt.length + reply.length) / 4)
      }
    };
    
    res.json(response);
  } catch (error: any) {
    console.error('Error generating response:', error);
    
    if (error.code === 'INVALID_API_KEY') {
      res.status(401).json({ 
        error: 'Invalid API key',
        message: 'The API key for this provider is invalid. Please update it in settings.'
      });
    } else if (error.code === 'RATE_LIMIT') {
      res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.'
      });
    } else {
      res.status(500).json({ 
        error: 'Generation failed',
        message: 'An error occurred while generating the response.'
      });
    }
  }
});

export default router;