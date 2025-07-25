import express from 'express';
import { requireAuth } from '../middleware/auth';
import { ImapOperations } from '../lib/imap-operations';
import { ToneLearningOrchestrator } from '../lib/pipeline/tone-learning-orchestrator';
import { VectorStore } from '../lib/vector/qdrant-client';
import { imapLogger } from '../lib/imap-logger';
import { EmailProcessor } from '../lib/email-processor';
import { ProcessedEmail } from '../lib/pipeline/types';

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

export default router;