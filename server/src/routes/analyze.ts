import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { extractEmailFeatures } from '../lib/nlp-feature-extractor';
import { relationshipService } from '../lib/relationships/relationship-service';
import { personService } from '../lib/relationships/person-service';
import { ToneLearningOrchestrator } from '../lib/pipeline/tone-learning-orchestrator';
import { VectorStore } from '../lib/vector/qdrant-client';
import { EmbeddingService } from '../lib/vector/embedding-service';
import { SelectedExample } from '../lib/pipeline/example-selector';
import { imapLogger } from '../lib/imap-logger';

// Extend Express Request to include user
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

const router = Router();

// Initialize services
let orchestrator: ToneLearningOrchestrator | null = null;
let vectorStore: VectorStore | null = null;
let embeddingService: EmbeddingService | null = null;

// Initialize services on first use
async function ensureServicesInitialized() {
  if (!orchestrator) {
    orchestrator = new ToneLearningOrchestrator();
    await orchestrator.initialize();
  }
  
  if (!vectorStore) {
    vectorStore = new VectorStore();
    await vectorStore.initialize();
  }
  
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
    await embeddingService.initialize();
  }
}

// Analyze email endpoint
router.post('/api/analyze/email', requireAuth, async (req: Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    await ensureServicesInitialized();
    
    const { emailBody, recipientEmail, relationshipType } = req.body;
    const userId = authenticatedReq.user.id;
    
    if (!emailBody || !recipientEmail) {
      return res.status(400).json({ error: 'Email body and recipient are required' });
    }
    
    // Emit initial event
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'email.received',
      data: {
        parsed: {
          recipient: recipientEmail,
          bodyLength: emailBody.length,
          wordCount: emailBody.split(/\s+/).filter(Boolean).length
        }
      }
    });
    
    // Step 1: Extract NLP features
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'nlp.extracting',
      data: {
        raw: 'Starting NLP feature extraction...'
      }
    });
    
    const nlpFeatures = extractEmailFeatures(emailBody, {
      email: recipientEmail,
      name: recipientEmail.split('@')[0]
    });
    
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'nlp.complete',
      data: {
        parsed: {
          sentiment: nlpFeatures.sentiment.primary,
          emotions: nlpFeatures.sentiment.emotions,
          formality: nlpFeatures.tonalQualities.formality,
          wordCount: nlpFeatures.stats.wordCount
        }
      }
    });
    
    // Step 2: Detect relationship
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'relationship.detecting',
      data: {
        raw: `Analyzing relationship with ${recipientEmail}...`
      }
    });
    
    let detectedRelationship: { relationship: string; confidence: number; method: string };
    if (relationshipType && relationshipType !== 'auto-detect') {
      // Map casual to friend for consistency
      const mappedRelationship = relationshipType === 'casual' ? 'friend' : relationshipType;
      detectedRelationship = {
        relationship: mappedRelationship,
        confidence: 1.0,
        method: 'user-specified'
      };
    } else {
      const detected = await orchestrator!['relationshipDetector'].detectRelationship({
        userId,
        recipientEmail,
        subject: '',
        historicalContext: {
          familiarityLevel: nlpFeatures.relationshipHints.familiarityLevel,
          hasIntimacyMarkers: nlpFeatures.relationshipHints.linguisticMarkers.endearments.length > 0,
          hasProfessionalMarkers: nlpFeatures.relationshipHints.linguisticMarkers.professionalPhrases.length > 0,
          formalityScore: nlpFeatures.tonalQualities.formality
        }
      });
      detectedRelationship = detected;
    }
    
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'relationship.detected',
      data: {
        parsed: {
          type: detectedRelationship.relationship,
          confidence: detectedRelationship.confidence,
          method: detectedRelationship.method
        }
      }
    });
    
    // Step 3: Look up person
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'person.lookup',
      data: {
        raw: `Searching for person: ${recipientEmail}`
      }
    });
    
    const person = await personService.findPersonByEmail(recipientEmail, userId);
    
    // Step 4: Get enhanced profile with aggregated style
    const enhancedProfile = await relationshipService.getEnhancedProfile(userId, recipientEmail);
    
    // Step 5: Search for similar emails
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'vector.searching',
      data: {
        raw: `Searching for similar emails to ${detectedRelationship.relationship}...`
      }
    });
    
    const { vector } = await embeddingService!.embedText(emailBody);
    const searchResults = await vectorStore!.searchSimilar({
      userId,
      queryVector: vector,
      relationship: detectedRelationship.relationship,
      limit: 5,
      scoreThreshold: 0.3
    });
    
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'vector.found',
      data: {
        parsed: {
          count: searchResults.length,
          topScore: searchResults[0]?.score || 0
        }
      }
    });
    
    // Check if style aggregation happened
    if (enhancedProfile?.aggregatedStyle) {
      imapLogger.log(userId, {
        userId,
        emailAccountId: 'demo-account-001',
        level: 'info',
        command: 'style.aggregating',
        data: {
          parsed: {
            emailCount: enhancedProfile.aggregatedStyle.emailCount,
            confidence: enhancedProfile.aggregatedStyle.confidenceScore
          }
        }
      });
    }
    
    // Step 6: Format examples for the prompt
    const selectedExamples: SelectedExample[] = searchResults.map(result => ({
      id: result.id,
      text: result.metadata.extractedText,
      score: result.score || 0,
      metadata: result.metadata
    }));
    
    // Get the prompt formatter to generate the actual prompt text
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'prompt.formatting',
      data: {
        raw: 'Building LLM prompt with examples and style profile...'
      }
    });
    
    const promptFormatter = orchestrator!['promptFormatter'];
    const formattedPrompt = await promptFormatter.formatWithExamples({
      incomingEmail: emailBody,
      recipientEmail,
      examples: selectedExamples,
      relationship: detectedRelationship.relationship,
      relationshipProfile: enhancedProfile,
      nlpFeatures: nlpFeatures
    });
    
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'pipeline.complete',
      data: {
        parsed: {
          promptLength: formattedPrompt.length,
          tokenEstimate: Math.ceil(formattedPrompt.length / 4)
        }
      }
    });
    
    // Return comprehensive analysis results
    return res.json({
      nlpFeatures,
      relationship: {
        type: detectedRelationship.relationship,
        confidence: detectedRelationship.confidence,
        method: detectedRelationship.method
      },
      person: person ? {
        name: person.name,
        email: person.emails[0]?.email_address,
        emailCount: searchResults.filter(r => 
          r.metadata.recipientEmail === recipientEmail
        ).length
      } : null,
      styleAggregation: enhancedProfile?.aggregatedStyle || null,
      selectedExamples: selectedExamples.slice(0, 5).map(ex => ({
        text: ex.text,
        relationship: ex.metadata.relationship?.type || 'unknown',
        score: ex.score,
        id: ex.id
      })),
      llmPrompt: formattedPrompt,
      enhancedProfile
    });
    
  } catch (error) {
    console.error('Email analysis error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;