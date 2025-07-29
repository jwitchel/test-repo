import express from 'express';
import { requireAuth } from '../middleware/auth';
import { ImapOperations } from '../lib/imap-operations';
import { ToneLearningOrchestrator } from '../lib/pipeline/tone-learning-orchestrator';
import { VectorStore } from '../lib/vector/qdrant-client';
import { imapLogger } from '../lib/imap-logger';
import { EmailProcessor } from '../lib/email-processor';
import { ProcessedEmail } from '../lib/pipeline/types';
import { WritingPatternAnalyzer } from '../lib/pipeline/writing-pattern-analyzer';

const router = express.Router();

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
    const emailProcessor = new EmailProcessor();
    
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
          // Process to extract user content
          const processedContent = emailProcessor.processEmail(fullMessage.parsed, {
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
            textContent: processedContent.userTextPlain,
            htmlContent: processedContent.userTextRich || null,
            extractedText: processedContent.userTextPlain
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
    const { force = false } = req.body;
    
    // Initialize services
    const patternAnalyzer = new WritingPatternAnalyzer();
    await patternAnalyzer.initialize();
    
    const vectorStore = new VectorStore();
    await vectorStore.initialize();
    
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
    
    // Get all unique relationships for this user from vector store
    const relationshipStats = await vectorStore.getRelationshipStats(userId);
    const relationships = Object.keys(relationshipStats);
    
    // Add 'aggregate' for overall patterns
    relationships.push('aggregate');
    
    let totalEmailsAnalyzed = 0;
    let relationshipsAnalyzed = 0;
    
    for (const relationship of relationships) {
      try {
        // Check if patterns already exist (unless forced)
        if (!force) {
          const existingPatterns = await patternAnalyzer.loadPatterns(userId, relationship === 'aggregate' ? undefined : relationship);
          if (existingPatterns) {
            imapLogger.log(userId, {
              userId,
              emailAccountId: 'pattern-training',
              level: 'info',
              command: 'patterns.training.skip',
              data: {
                raw: `Skipping ${relationship} - patterns already exist`
              }
            });
            continue;
          }
        }
        
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
        
        // Convert to ProcessedEmail format
        const emailsForAnalysis = emails.map((email: any) => ({
          uid: email.id,
          messageId: email.id,
          inReplyTo: null,
          date: new Date(email.metadata.sentDate || Date.now()),
          from: [{ address: userId, name: '' }],
          to: [{ address: email.metadata.recipientEmail || '', name: '' }],
          cc: [],
          bcc: [],
          subject: email.metadata.subject || '',
          textContent: email.metadata.extractedText || '',
          htmlContent: null,
          extractedText: email.metadata.extractedText || ''
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
                closings: patterns.closingPatterns.length,
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

export default router;