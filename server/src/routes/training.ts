import express from 'express';
import { requireAuth } from '../middleware/auth';
import { ImapOperations } from '../lib/imap-operations';
import { ToneLearningOrchestrator } from '../lib/pipeline/tone-learning-orchestrator';
import { VectorStore } from '../lib/vector/qdrant-client';
import { imapLogger } from '../lib/imap-logger';
import { EmailProcessor } from '../lib/email-processor';
import { ProcessedEmail } from '../lib/pipeline/types';
import { WritingPatternAnalyzer } from '../lib/pipeline/writing-pattern-analyzer';
import { RegexSignatureDetector } from '../lib/regex-signature-detector';
import { pool } from '../server';
import { EmbeddingService } from '../lib/vector/embedding-service';

const router = express.Router();
const regexSignatureDetector = new RegexSignatureDetector(pool);
const emailProcessor = new EmailProcessor(pool);

// Load sent emails into vector DB
router.post('/load-sent-emails', requireAuth, async (req, res): Promise<void> => {
  let imapOps: ImapOperations | null = null;
  
  try {
    const userId = (req as any).user.id;
    const { emailAccountId, limit = 1000, startDate } = req.body;
    
    
    if (!emailAccountId || !startDate) {
      res.status(400).json({ error: 'emailAccountId and startDate are required' });
      return;
    }

    // Initialize services
    imapOps = await ImapOperations.fromAccountId(emailAccountId, userId);
    const orchestrator = new ToneLearningOrchestrator();
    
    // Convert startDate to Date object and add 1 day to make it inclusive
    const beforeDate = new Date(startDate);
    beforeDate.setDate(beforeDate.getDate() + 1);
    
    // Search for sent emails
    imapLogger.log(userId, {
      userId,
      emailAccountId,
      level: 'info',
      command: 'TRAINING_START',
      data: { 
        parsed: { limit, startDate, folder: 'Sent' }
      }
    });

    // Search in Sent folder
    const sentFolders = ['Sent', 'Sent Items', 'Sent Mail', '[Gmail]/Sent Mail'];
    let messages: any[] = [];
    let folderUsed = '';
    
    for (const folder of sentFolders) {
      try {
        
        // Search with date criteria
        const searchResults = await imapOps.searchMessages(folder, {
          before: beforeDate
        }, { limit });
        
        if (searchResults.length > 0) {
          messages = searchResults;
          folderUsed = folder;
          break;
        }
      } catch (err) {
        console.log(`Error searching ${folder}:`, err);
        // Try next folder
        continue;
      }
    }

    if (messages.length === 0) {
      res.status(404).json({ error: 'No sent emails found' });
      return;
    }

    imapLogger.log(userId, {
      userId,
      emailAccountId,
      level: 'info',
      command: 'TRAINING_FOUND_EMAILS',
      data: { 
        parsed: { found: messages.length, folder: folderUsed }
      }
    });

    // First, collect a sample of emails to detect signature
    imapLogger.log(userId, {
      userId,
      emailAccountId,
      level: 'info',
      command: 'SIGNATURE_DETECTION_START',
      data: { 
        raw: 'Analyzing emails to detect signature pattern...'
      }
    });



    // Simple sequential processing
    let processed = 0;
    let errors = 0;
    const startTime = Date.now();
    const totalMessages = messages.length;

    
    // Simple for loop - process one email at a time
    for (let i = 0; i < totalMessages; i++) {
      const message = messages[i];
      
      try {
        // Fetch full message with body content
        const fullMessage = await imapOps.getMessage(folderUsed, message.uid);
        
        if (fullMessage.parsed) {
          // Get the ORIGINAL text from the parsed email (before any processing)
          const originalText = fullMessage.parsed.text || '';
          const originalHtml = fullMessage.parsed.html || null;
          
          // Process to extract user content
          const processedContent = await emailProcessor.processEmail(fullMessage.parsed, {
            userId,
            emailAccountId
          });

          // Convert to ProcessedEmail format for pipeline
          const pipelineEmail: ProcessedEmail = {
            uid: message.uid.toString(),
            messageId: fullMessage.parsed.messageId || `${message.uid}@${emailAccountId}`,
            inReplyTo: fullMessage.parsed.inReplyTo as string | null || null,
            date: fullMessage.parsed.date || new Date(),
            from: fullMessage.parsed.from ? [{
              address: fullMessage.parsed.from.value[0]?.address || '',
              name: fullMessage.parsed.from.value[0]?.name || ''
            }] : [],
            to: fullMessage.parsed.to ? 
              (Array.isArray(fullMessage.parsed.to) ? fullMessage.parsed.to : fullMessage.parsed.to.value).map((addr: any) => ({
                address: addr.address || '',
                name: addr.name || ''
              })) : [],
            cc: [],
            bcc: [],
            subject: fullMessage.parsed.subject || '',
            textContent: originalText,  // ORIGINAL text (with quotes, signatures, etc)
            htmlContent: originalHtml,   // ORIGINAL HTML
            extractedText: processedContent.userTextPlain  // PROCESSED text (sender's content only)
          };

          // Process ONE email at a time through the orchestrator - sequential method
          const result = await orchestrator.ingestSingleEmail(
            userId,
            emailAccountId,
            pipelineEmail  // Single email, not array
          );
          
          processed += result.processed;
          errors += result.errors;
          
          
          // Log progress every 10 emails
          if ((i + 1) % 10 === 0 || i === totalMessages - 1) {
            imapLogger.log(userId, {
              userId,
              emailAccountId,
              level: 'info',
              command: 'TRAINING_PROGRESS',
              data: {
                parsed: {
                  processed: i + 1,
                  total: totalMessages,
                  errors,
                  percentage: Math.round(((i + 1) / totalMessages) * 100)
                }
              }
            });
          }
          
          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      } catch (err) {
        errors++;
        console.error(`Error processing email ${i + 1}:`, err);
        imapLogger.log(userId, {
          userId,
          emailAccountId,
          level: 'error',
          command: 'TRAINING_EMAIL_ERROR',
          data: { 
            error: err instanceof Error ? err.message : 'Unknown error',
            parsed: { uid: message.uid, index: i }
          }
        });
      }
    }
    
    
    // Aggregate styles after all emails are processed
    try {
      await orchestrator.aggregateStyles(userId);
    } catch (err) {
      console.error('Style aggregation error:', err);
    }

    const duration = Date.now() - startTime;
    
    imapLogger.log(userId, {
      userId,
      emailAccountId,
      level: 'info',
      command: 'TRAINING_COMPLETE',
      data: { 
        parsed: { processed, errors, duration }
      }
    });

    // Clean up IMAP connection
    imapOps.release();
    
    // Give WebSocket time to send the completion message before responding
    await new Promise(resolve => setTimeout(resolve, 100));
    
    
    res.json({
      success: true,
      processed,
      errors,
      duration
    });

  } catch (error) {
    console.error('Training error:', error);
    // Clean up IMAP connection on error
    if (imapOps) {
      imapOps.release();
    }
    res.status(500).json({ 
      error: 'Training failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Wipe user's vector DB data
router.delete('/wipe', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    
    const vectorStore = new VectorStore();
    await vectorStore.initialize();
    await vectorStore.deleteUserData(userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Wipe error:', error);
    res.status(500).json({ 
      error: 'Failed to wipe data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Analyze writing patterns
router.post('/analyze-patterns', requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).user.id;
  const startTime = Date.now();
  
  try {
    // Initialize services
    const patternAnalyzer = new WritingPatternAnalyzer();
    await patternAnalyzer.initialize();
    
    const vectorStore = new VectorStore();
    await vectorStore.initialize();
    
    
    // Clear existing patterns to make the operation idempotent
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'pattern-training',
      level: 'info',
      command: 'patterns.training.clearing',
      data: {
        raw: 'Clearing existing writing patterns...'
      }
    });
    
    await patternAnalyzer.clearPatterns(userId);
    
    // Get relationship stats
    const relationshipStats = await vectorStore.getRelationshipStats(userId);
    const relationships = Object.keys(relationshipStats);
    
    // Log the start of pattern analysis
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'pattern-training',
      level: 'info',
      command: 'patterns.training.start',
      data: {
        raw: 'Starting comprehensive pattern analysis for all relationships'
      }
    });
    
    // Note: relationshipStats and relationships were already retrieved above for signature detection
    
    // Add 'aggregate' for overall patterns
    relationships.push('aggregate');
    
    let totalEmailsAnalyzed = 0;
    let relationshipsAnalyzed = 0;
    const emailCountsByRelationship: Record<string, number> = {};
    
    for (const relationship of relationships) {
      try {
        
        // Fetch emails for this relationship
        const corpusSize = parseInt(process.env.PATTERN_ANALYSIS_CORPUS_SIZE || '200');
        let emails;
        
        if (relationship === 'aggregate') {
          // For aggregate, get a sample across all relationships
          const sampleEmails: any[] = [];
          const perRelationshipLimit = Math.ceil(corpusSize / Math.max(relationships.length - 1, 1));
          
          for (const rel of relationships) {
            if (rel === 'aggregate') continue;
            const relEmails = await vectorStore.getByRelationship(userId, rel, perRelationshipLimit);
            sampleEmails.push(...relEmails);
          }
          
          emails = sampleEmails.slice(0, corpusSize);
        } else {
          // Get emails for specific relationship
          emails = await vectorStore.getByRelationship(userId, relationship, corpusSize);
        }
        
        if (emails.length === 0) {
          imapLogger.log(userId, {
            userId,
            emailAccountId: 'pattern-training',
            level: 'info',
            command: 'patterns.training.skip',
            data: {
              raw: `Skipping ${relationship} - no emails found`
            }
          });
          continue;
        }
        
        // Convert to ProcessedEmail format and remove signatures using regex patterns
        const emailsForAnalysis = await Promise.all(emails.map(async (email: any) => {
          let extractedText = email.metadata.extractedText || '';
          
          // Remove signature using regex patterns
          const signatureResult = await regexSignatureDetector.removeSignature(extractedText, userId);
          extractedText = signatureResult.cleanedText;
          
          if (email === emails[0] && signatureResult.signature) {
            console.log(`[Pattern Analysis] Signature removal for first email in '${relationship}':`);
            console.log(`  Matched pattern: ${signatureResult.matchedPattern}`);
            console.log(`  Text now ends with:`, extractedText.split('\n').slice(-5).join(' | '));
          }
          
          return {
            uid: email.id,
            messageId: email.id,
            inReplyTo: null,
            date: new Date(email.metadata.sentDate || Date.now()),
            from: [{ address: userId, name: '' }],
            to: [{ address: email.metadata.recipientEmail || '', name: '' }],
            cc: [],
            bcc: [],
            subject: email.metadata.subject || '',
            textContent: extractedText,
            htmlContent: null,
            extractedText: extractedText
          };
        }));
        
        imapLogger.log(userId, {
          userId,
          emailAccountId: 'pattern-training',
          level: 'info',
          command: 'patterns.training.analyzing',
          data: {
            parsed: {
              relationship,
              emailCount: emailsForAnalysis.length
            }
          }
        });
        
        // Analyze patterns
        const patterns = await patternAnalyzer.analyzeWritingPatterns(
          userId,
          emailsForAnalysis,
          relationship === 'aggregate' ? undefined : relationship
        );
        
        // Save patterns
        await patternAnalyzer.savePatterns(
          userId,
          patterns,
          relationship === 'aggregate' ? undefined : relationship,
          emailsForAnalysis.length
        );
        
        totalEmailsAnalyzed += emailsForAnalysis.length;
        relationshipsAnalyzed++;
        
        // Track email counts per relationship (excluding 'aggregate')
        if (relationship !== 'aggregate') {
          emailCountsByRelationship[relationship] = emailsForAnalysis.length;
        }
        
        imapLogger.log(userId, {
          userId,
          emailAccountId: 'pattern-training',
          level: 'info',
          command: 'patterns.training.saved',
          data: {
            parsed: {
              relationship,
              emailsAnalyzed: emailsForAnalysis.length,
              patternsFound: {
                openings: patterns.openingPatterns.length,
                valedictions: patterns.valediction.length,
                typedNames: patterns.typedName.length,
                negative: patterns.negativePatterns.length,
                unique: patterns.uniqueExpressions.length
              }
            }
          }
        });
        
      } catch (error) {
        console.error(`Error analyzing patterns for ${relationship}:`, error);
        imapLogger.log(userId, {
          userId,
          emailAccountId: 'pattern-training',
          level: 'error',
          command: 'patterns.training.error',
          data: {
            error: error instanceof Error ? error.message : 'Unknown error',
            parsed: { relationship }
          }
        });
      }
    }
    
    // Collect all patterns for final output
    const consolidatedPatterns: Record<string, any> = {};
    
    for (const relationship of relationships) {
      try {
        const patterns = await patternAnalyzer.loadPatterns(userId, relationship === 'aggregate' ? undefined : relationship);
        if (patterns) {
          consolidatedPatterns[relationship] = patterns;
        }
      } catch (error) {
        console.error(`Error loading patterns for ${relationship}:`, error);
      }
    }
    
    const endTime = Date.now();
    const durationSeconds = Math.round((endTime - startTime) / 1000);
    
    // Create consolidated output with meta block
    const consolidatedOutput = {
      meta: {
        analysisDate: new Date().toISOString(),
        totalEmailsAnalyzed,
        relationshipsAnalyzed: relationshipsAnalyzed - 1, // Exclude 'aggregate' from count
        relationships: relationships.filter(r => r !== 'aggregate'),
        emailCountsByRelationship,
        includesAggregatePatterns: true, // Indicate that aggregate patterns are included
        durationSeconds,
        corpusSize: parseInt(process.env.PATTERN_ANALYSIS_CORPUS_SIZE || '200'),
        maxTokens: parseInt(process.env.PATTERN_ANALYSIS_MAX_TOKENS || '20000'),
        modelUsed: patternAnalyzer.getModelName()
      },
      patterns: consolidatedPatterns
    };
    
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'pattern-training',
      level: 'info',
      command: 'patterns.training.complete',
      data: {
        parsed: {
          totalEmailsAnalyzed,
          relationshipsAnalyzed: relationshipsAnalyzed - 1, // Actual relationship count
          aggregatePatternsIncluded: true,
          relationships: relationships.filter(r => r !== 'aggregate')
        }
      }
    });
    
    // Output consolidated patterns JSON to logs
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'pattern-training',
      level: 'info',
      command: 'patterns.training.consolidated',
      data: {
        raw: JSON.stringify(consolidatedOutput, null, 2)
      }
    });
    
    res.json({
      success: true,
      emailsAnalyzed: totalEmailsAnalyzed,
      relationshipsAnalyzed: relationshipsAnalyzed - 1, // Subtract 1 to exclude 'aggregate' from count
      relationships: relationships.filter(r => r !== 'aggregate'),
      patterns: consolidatedPatterns
    });
    
  } catch (error) {
    console.error('Pattern analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze patterns',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clean signatures from existing emails
router.post('/clean-emails', requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    
    // Log the start of cleaning
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'all',
      level: 'info',
      command: 'CLEAN_EMAILS_START',
      data: { 
        parsed: { action: 'Starting email signature cleaning' }
      }
    });

    // Initialize services
    const vectorStore = new VectorStore();
    await vectorStore.initialize();
    
    const embeddingService = new EmbeddingService();
    await embeddingService.initialize();
    
    // Get all relationships for the user
    const relationshipStats = await vectorStore.getRelationshipStats(userId);
    const relationships = Object.keys(relationshipStats);
    
    let totalProcessed = 0;
    let totalCleaned = 0;
    const results: any[] = [];
    
    for (const relationship of relationships) {
      const emails = await vectorStore.getByRelationship(userId, relationship, 1000);
      
      for (const email of emails) {
        // Use rawText if available, otherwise use extractedText
        const originalText = email.metadata.rawText || email.metadata.extractedText || '';
        
        // Remove signature
        const result = await regexSignatureDetector.removeSignature(originalText, userId);
        
        if (result.signature && result.cleanedText.trim()) {
          // Log the email that was cleaned
          imapLogger.log(userId, {
            userId,
            emailAccountId: 'all',
            level: 'info',
            command: 'CLEAN_EMAIL',
            data: { 
              parsed: {
                emailId: email.id,
                relationship,
                status: 'cleaned',
                before: originalText,
                after: result.cleanedText,
                signatureRemoved: result.signature,
                matchedPattern: result.matchedPattern
              }
            }
          });
          
          // Update the email in vector store
          const updatedMetadata = {
            ...email.metadata,
            extractedText: result.cleanedText,
            rawText: originalText
          };
          
          // Re-embed with cleaned text
          const { vector } = await embeddingService.embedText(result.cleanedText);
          
          // Update in vector store
          await vectorStore.upsertEmail({
            id: email.id,
            userId,
            vector,
            metadata: updatedMetadata
          });
          
          totalCleaned++;
          results.push({
            emailId: email.id,
            relationship,
            signatureLength: result.signature.split('\n').length
          });
        } else {
          // Log emails that didn't need cleaning
          imapLogger.log(userId, {
            userId,
            emailAccountId: 'all',
            level: 'info',
            command: 'CLEAN_EMAIL',
            data: { 
              parsed: {
                emailId: email.id,
                relationship,
                status: 'no_signature_found',
                text: originalText
              }
            }
          });
        }
        
        totalProcessed++;
      }
    }
    
    // Log completion
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'all',
      level: 'info',
      command: 'CLEAN_EMAILS_COMPLETE',
      data: { 
        parsed: {
          totalProcessed,
          totalCleaned,
          percentageCleaned: totalProcessed > 0 ? (totalCleaned / totalProcessed * 100).toFixed(1) : 0
        }
      }
    });
    
    res.json({
      success: true,
      totalProcessed,
      totalCleaned,
      percentageCleaned: totalProcessed > 0 ? (totalCleaned / totalProcessed * 100).toFixed(1) : 0,
      results: results.slice(0, 10) // Return first 10 for UI feedback
    });
    
  } catch (error) {
    console.error('Error cleaning emails:', error);
    
    const userId = (req as any).user.id;
    imapLogger.log(userId, {
      userId,
      emailAccountId: 'all',
      level: 'error',
      command: 'CLEAN_EMAILS_ERROR',
      data: { 
        parsed: { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      }
    });
    
    res.status(500).json({ 
      error: 'Failed to clean emails',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;