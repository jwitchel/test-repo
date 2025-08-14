import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { extractEmailFeatures } from '../lib/nlp-feature-extractor';
import { relationshipService } from '../lib/relationships/relationship-service';
import { personService } from '../lib/relationships/person-service';
import { ToneLearningOrchestrator } from '../lib/pipeline/tone-learning-orchestrator';
import { imapLogger } from '../lib/imap-logger';
import { replyExtractor } from '../lib/reply-extractor';

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

// Initialize services on first use
async function ensureServicesInitialized() {
  if (!orchestrator) {
    orchestrator = new ToneLearningOrchestrator();
    await orchestrator.initialize();
  }
}

// Remove obvious signature blocks from incoming emails
function removeIncomingEmailSignature(text: string): string {
  const lines = text.split('\n');
  let signatureStart = -1;
  
  // Look for common signature delimiters
  const signatureDelimiters = [
    /^--\s*$/,
    /^—+\s*$/,
    /^_{3,}\s*$/,
    /^-{3,}\s*$/,
    /^={3,}\s*$/,
    /^\*{3,}\s*$/
  ];
  
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 15); i--) {
    const line = lines[i].trim();
    
    // Check for delimiter
    if (signatureDelimiters.some(pattern => pattern.test(line))) {
      signatureStart = i;
      break;
    }
    
    // Check for lines that commonly appear in signatures
    if (i < lines.length - 2) { // Need at least 2 lines to be a signature
      const remainingLines = lines.slice(i).join('\n');
      
      // Pattern matching for signature indicators
      const hasPhone = /\b(cell|mobile|phone|tel)[:.]?\s*[\d\s\-\(\)]+/i.test(remainingLines);
      const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(remainingLines);
      const hasUrl = /https?:\/\/[^\s]+/.test(remainingLines);
      const hasJobTitle = /\b(CEO|CTO|CFO|Manager|Director|Partner|Founder|Investor|President|VP|Engineer|Developer)\b/i.test(remainingLines);
      const hasPipe = /\|/.test(remainingLines);
      const hasAddress = /\b(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Suite|Ste)\b/i.test(remainingLines);
      
      // If we find 2+ signature indicators, assume it's a signature
      const indicators = [hasPhone, hasEmail, hasUrl, hasJobTitle, hasPipe, hasAddress].filter(Boolean).length;
      if (indicators >= 2) {
        signatureStart = i;
      }
    }
  }
  
  if (signatureStart > 0) {
    // Remove the signature and trailing empty lines
    const result = lines.slice(0, signatureStart);
    while (result.length > 0 && result[result.length - 1].trim() === '') {
      result.pop();
    }
    return result.join('\n');
  }
  
  return text;
}

// Analyze email endpoint
router.post('/api/analyze/email', requireAuth, async (req: Request, res: Response) => {
  const authenticatedReq = req as AuthenticatedRequest;
  try {
    await ensureServicesInitialized();
    
    const { emailBody, recipientEmail, relationshipType, providerId } = req.body;
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
    
    // Step 1: Extract only the user's written text (removes quoted content and reply chains)
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'reply.extracting',
      data: {
        raw: 'Extracting user text from email (removing quoted content)...'
      }
    });
    
    const extractedContent = replyExtractor.extractUserText(emailBody);
    
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'reply.extracted',
      data: {
        parsed: {
          originalLength: emailBody.length,
          extractedLength: extractedContent.length,
          reductionPercentage: emailBody.length > 0 
            ? Math.round((1 - extractedContent.length / emailBody.length) * 100)
            : 0
        }
      }
    });
    
    // Step 1.5: Remove signature from the extracted content
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'signature.removing',
      data: {
        raw: 'Removing signature blocks from email...'
      }
    });
    
    const cleanedContent = removeIncomingEmailSignature(extractedContent);
    
    if (cleanedContent.length < extractedContent.length) {
      const removedText = extractedContent.substring(cleanedContent.length);
      imapLogger.log(userId, {
        userId,
        emailAccountId: 'demo-account-001',
        level: 'info',
        command: 'signature.removed',
        data: {
          parsed: {
            originalLength: extractedContent.length,
            cleanedLength: cleanedContent.length,
            removedChars: extractedContent.length - cleanedContent.length,
            removedText: removedText.trim()
          }
        }
      });
    } else {
      imapLogger.log(userId, {
        userId,
        emailAccountId: 'demo-account-001',
        level: 'info',
        command: 'signature.not_found',
        data: {
          raw: 'No signature detected in the email'
        }
      });
    }
    
    // Step 2: Extract NLP features from the cleaned text
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'nlp.extracting',
      data: {
        raw: 'Starting NLP feature extraction...'
      }
    });
    
    const nlpFeatures = extractEmailFeatures(cleanedContent, {
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
    
    // Step 3: Detect relationship
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
    
    // Step 4: Look up person
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
    
    // Step 5: Get enhanced profile with aggregated style
    const enhancedProfile = await relationshipService.getEnhancedProfile(userId, recipientEmail);
    
    // Step 6: Use example selector to find relevant emails
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'examples.selecting',
      data: {
        raw: `Selecting examples for ${recipientEmail} (${detectedRelationship.relationship})...`
      }
    });
    
    // Use the orchestrator's example selector which implements the two-phase selection
    const exampleSelection = await orchestrator!['exampleSelector'].selectExamples({
      userId,
      incomingEmail: cleanedContent,
      recipientEmail,
      desiredCount: parseInt(process.env.EXAMPLE_COUNT || '25')
    });
    
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'examples.selected',
      data: {
        parsed: {
          totalSelected: exampleSelection.examples.length,
          directCorrespondence: exampleSelection.stats.directCorrespondence,
          relationshipMatch: exampleSelection.stats.relationshipMatch,
          totalCandidates: exampleSelection.stats.totalCandidates
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
    
    // Step 7: Examples are already formatted by the example selector
    const selectedExamples = exampleSelection.examples;
    
    // Step 8: Analyze writing patterns
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'patterns.analyzing',
      data: {
        raw: 'Analyzing writing patterns from examples...'
      }
    });
    
    const patternAnalyzer = orchestrator!['patternAnalyzer'];
    
    // Initialize pattern analyzer with the selected provider or let it use default
    try {
      await patternAnalyzer.initialize(providerId);
    } catch (error) {
      console.error('Failed to initialize pattern analyzer:', error);
      // Continue without pattern analysis if initialization fails
    }
    
    let writingPatterns = null;
    
    try {
      // First try to load aggregate patterns (overall tone profile)
      writingPatterns = await patternAnalyzer.loadPatterns(userId);
      
      if (writingPatterns) {
        imapLogger.log(userId, {
          userId,
          emailAccountId: 'demo-account-001',
          level: 'info',
          command: 'patterns.loaded',
          data: {
            raw: 'Loaded aggregate writing patterns from tone profile',
            parsed: {
              type: 'aggregate',
              hasPatterns: true
            }
          }
        });
      } else {
        // If no aggregate patterns, try relationship-specific patterns
        writingPatterns = await patternAnalyzer.loadPatterns(userId, detectedRelationship.relationship);
        
        if (writingPatterns) {
          imapLogger.log(userId, {
            userId,
            emailAccountId: 'demo-account-001',
            level: 'info',
            command: 'patterns.loaded',
            data: {
              raw: `Loaded relationship-specific patterns for ${detectedRelationship.relationship}`,
              parsed: {
                type: 'relationship',
                relationship: detectedRelationship.relationship,
                hasPatterns: true
              }
            }
          });
        }
      }
      
      // If no patterns exist, analyze from a larger corpus
      if (!writingPatterns && patternAnalyzer['llmClient']) {
        imapLogger.log(userId, {
          userId,
          emailAccountId: 'demo-account-001',
          level: 'info',
          command: 'patterns.fetching_corpus',
          data: {
            raw: 'Fetching larger email corpus for pattern analysis...'
          }
        });
        
        // Fetch more emails for pattern analysis
        const corpusSize = parseInt(process.env.PATTERN_ANALYSIS_CORPUS_SIZE || '200');
        const patternCorpus = await orchestrator!['vectorStore'].getByRelationship(
          userId,
          detectedRelationship.relationship,
          corpusSize
        );
        
        if (patternCorpus.length > 0) {
          imapLogger.log(userId, {
            userId,
            emailAccountId: 'demo-account-001',
            level: 'info',
            command: 'patterns.corpus_size',
            data: {
              parsed: {
                totalEmails: patternCorpus.length,
                maxRequested: corpusSize,
                relationship: detectedRelationship.relationship
              }
            }
          });
          
          const emailsForAnalysis = patternCorpus.map(result => ({
            uid: result.id,
            messageId: result.id,
            inReplyTo: null,
            date: new Date(result.metadata.sentDate || Date.now()),
            from: [{ address: userId, name: '' }],  // User is the sender for their own emails
            to: [{ address: result.metadata.recipientEmail || recipientEmail, name: '' }],
            cc: [],
            bcc: [],
            subject: result.metadata.subject || '',
            textContent: result.metadata.userReply || '',
            htmlContent: null,
            userReply: result.metadata.userReply || '',
            respondedTo: ''
          }));
          
          writingPatterns = await patternAnalyzer.analyzeWritingPatterns(
            userId,
            emailsForAnalysis,
            detectedRelationship.relationship
          );
          
          // Save patterns for future use
          await patternAnalyzer.savePatterns(
            userId,
            writingPatterns,
            detectedRelationship.relationship,
            emailsForAnalysis.length
          );
        }
      }
    } catch (error) {
      console.error('Pattern analysis failed, continuing without patterns:', error);
      // Continue without patterns - they're optional
    }
    
    if (writingPatterns) {
      imapLogger.log(userId, {
        userId,
        emailAccountId: 'demo-account-001',
        level: 'info',
        command: 'patterns.analyzed',
        data: {
          parsed: {
            sentenceAvgLength: writingPatterns.sentencePatterns.avgLength,
            openingPatternsCount: writingPatterns.openingPatterns.length,
            uniqueExpressionsCount: writingPatterns.uniqueExpressions.length
          }
        }
      });
    }
    
    // Get the prompt formatter to generate the actual prompt text
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'demo-account-001',
      level: 'info',
      command: 'prompt.formatting',
      data: {
        raw: 'Building LLM prompt with examples, style profile, and writing patterns...'
      }
    });
    
    const promptFormatter = orchestrator!['promptFormatter'];
    const formattedPrompt = await promptFormatter.formatWithExamples({
      incomingEmail: cleanedContent,
      recipientEmail,
      examples: selectedExamples,
      relationship: detectedRelationship.relationship,
      relationshipProfile: enhancedProfile,
      nlpFeatures: nlpFeatures,
      writingPatterns
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
        emailCount: exampleSelection.stats.directCorrespondence
      } : null,
      styleAggregation: enhancedProfile?.aggregatedStyle || null,
      selectedExamples: selectedExamples.map(ex => ({
        text: ex.text,
        relationship: ex.metadata.relationship?.type || 'unknown',
        score: ex.score,
        id: ex.id
      })),
      llmPrompt: formattedPrompt,
      enhancedProfile,
      writingPatterns
    });
    
  } catch (error) {
    console.error('Email analysis error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint to check Qdrant record by ID
router.get('/debug/qdrant/:messageId', requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureServicesInitialized();
    
    const { messageId } = req.params;
    const userId = (req as AuthenticatedRequest).user.id;
    
    console.log('[analyze/debug] Looking up Qdrant record:', { messageId, userId });
    
    // Get the Qdrant client
    const vectorStore = orchestrator!['vectorStore'];
    const qdrantClient = vectorStore['client'];
    
    // Convert messageId to numeric ID (same hash function as in qdrant-client.ts)
    let hash = 0;
    for (let i = 0; i < messageId.length; i++) {
      const char = messageId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const numericId = Math.abs(hash);
    
    console.log('[analyze/debug] Numeric ID:', numericId);
    
    // Retrieve the point from Qdrant
    const points = await qdrantClient.retrieve('user-emails', {
      ids: [numericId],
      with_payload: true,
      with_vector: false
    });
    
    if (points.length === 0) {
      return res.status(404).json({ 
        error: 'Record not found',
        messageId,
        numericId 
      });
    }
    
    const payload = points[0].payload as any;
    
    return res.json({
      found: true,
      messageId,
      numericId,
      payload,
      recipientEmail: payload?.recipientEmail || 'not found',
      senderEmail: payload?.senderEmail || 'not found',
      userId: payload?.userId || 'not found',
      emailType: payload?.emailType || 'not found',
      subject: payload?.subject || 'not found',
      hasLlmResponse: !!payload?.llmResponse
    });
    
  } catch (error) {
    console.error('Qdrant debug error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve Qdrant record',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;