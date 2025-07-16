import { ParsedMail } from 'mailparser';
import { emailTextExtractor, ExtractedText } from './email-text-extractor';
import { replyExtractor } from './reply-extractor';
import { imapLogger } from './imap-logger';

export interface ProcessedEmail extends ExtractedText {
  userTextPlain: string;    // Override to ensure it's the extracted user text
  userTextRich?: string;    // Override to ensure it's the extracted user text
  originalPlainLength: number;
  originalRichLength?: number;
  isReply: boolean;
  hasQuotedContent: boolean;
}

export interface ProcessingContext {
  userId: string;
  emailAccountId: string;
}

export class EmailProcessor {
  /**
   * Process a parsed email to extract only the user's written content
   */
  processEmail(parsedMail: ParsedMail, context?: ProcessingContext): ProcessedEmail {
    const startTime = Date.now();
    
    // Log the start of processing
    if (context) {
      imapLogger.log(context.userId, {
        userId: context.userId,
        emailAccountId: context.emailAccountId,
        level: 'info',
        command: 'EMAIL_PARSE_START',
        data: {
          parsed: {
            messageId: parsedMail.messageId,
            subject: parsedMail.subject,
            from: parsedMail.from?.text,
            date: parsedMail.date?.toISOString(),
            originalText: parsedMail.text?.substring(0, 500) + (parsedMail.text && parsedMail.text.length > 500 ? '...' : '')
          }
        }
      });
    }
    
    // First, extract the basic email content
    const extracted = emailTextExtractor.extractFromParsed(parsedMail);
    
    // Store original lengths for comparison
    const originalPlainLength = extracted.userTextPlain.length;
    const originalRichLength = extracted.userTextRich?.length;

    // Extract only the user's written text from plain text
    const plainResult = replyExtractor.extractWithMetadata(extracted.userTextPlain);
    
    // Extract only the user's written text from HTML if available
    let processedRichText: string | undefined;
    let richHasQuoted = false;
    
    if (extracted.userTextRich) {
      // For HTML content, we need to extract the reply content
      // This is a bit more complex as we need to preserve HTML structure
      processedRichText = replyExtractor.extractFromHtml(extracted.userTextRich);
      
      // Check if the HTML version had quoted content
      const richResult = replyExtractor.extractWithMetadata(
        replyExtractor.extractFromHtml(extracted.userTextRich)
      );
      richHasQuoted = richResult.hasQuotedContent;
    }

    const result: ProcessedEmail = {
      ...extracted,
      userTextPlain: plainResult.extractedText,
      userTextRich: processedRichText,
      originalPlainLength,
      originalRichLength,
      isReply: plainResult.isReply,
      hasQuotedContent: plainResult.hasQuotedContent || richHasQuoted
    };

    // Log the completion of processing
    if (context) {
      const duration = Date.now() - startTime;
      imapLogger.log(context.userId, {
        userId: context.userId,
        emailAccountId: context.emailAccountId,
        level: 'info',
        command: 'EMAIL_PARSE_COMPLETE',
        data: {
          duration,
          parsed: {
            messageId: parsedMail.messageId,
            originalLength: originalPlainLength,
            extractedLength: result.userTextPlain.length,
            extractedText: result.userTextPlain,
            isReply: result.isReply,
            hasQuotedContent: result.hasQuotedContent,
            reductionPercentage: originalPlainLength > 0 
              ? Math.round((1 - result.userTextPlain.length / originalPlainLength) * 100)
              : 0
          }
        }
      });
    }

    return result;
  }

  /**
   * Process raw email data
   */
  async processRawEmail(rawEmail: string | Buffer, context?: ProcessingContext): Promise<ProcessedEmail> {
    const parsed = await emailTextExtractor.extractFromRaw(rawEmail);
    
    // Convert ExtractedText to ParsedMail-like structure for processing
    // This is a bit of a hack, but works for our use case
    const pseudoParsed = {
      messageId: parsed.messageId,
      date: parsed.sentDate,
      text: parsed.userTextPlain,
      html: parsed.userTextRich,
      from: { text: parsed.from, value: [{ address: parsed.from }] },
      to: { text: parsed.to.join(', '), value: parsed.to.map(addr => ({ address: addr })) }
    } as any as ParsedMail;
    
    return this.processEmail(pseudoParsed, context);
  }
}

// Export singleton instance
export const emailProcessor = new EmailProcessor();