import EmailReplyParser from 'email-reply-parser';

export interface ReplyExtractionResult {
  extractedText: string;
  isReply: boolean;
  hasQuotedContent: boolean;
}

export class ReplyExtractor {
  private parser: EmailReplyParser;

  constructor() {
    this.parser = new EmailReplyParser();
  }

  /**
   * Extract only the user's written text from an email, removing all quoted content
   */
  extractUserText(emailBody: string): string {
    if (!emailBody || emailBody.trim() === '') {
      return '';
    }

    try {
      // Parse the email body
      const parsed = this.parser.read(emailBody);
      
      // Get only the non-quoted fragments
      // Include signatures (even if marked as hidden) since they're part of user's writing style
      const visibleFragments = parsed.getFragments()
        .filter(fragment => !fragment.isQuoted())
        .map(fragment => fragment.getContent())
        .join('\n');
      
      return visibleFragments.trim();
    } catch (error) {
      // If parsing fails, return the original text
      console.error('Failed to parse email for reply extraction:', error);
      return emailBody.trim();
    }
  }

  /**
   * Extract user text with additional metadata about the email
   */
  extractWithMetadata(emailBody: string): ReplyExtractionResult {
    if (!emailBody || emailBody.trim() === '') {
      return {
        extractedText: '',
        isReply: false,
        hasQuotedContent: false
      };
    }

    try {
      const parsed = this.parser.read(emailBody);
      const fragments = parsed.getFragments();
      
      // Get only the non-quoted fragments
      // Include signatures (even if marked as hidden) since they're part of user's writing style
      const visibleFragments = fragments
        .filter(fragment => !fragment.isQuoted())
        .map(fragment => fragment.getContent())
        .join('\n')
        .trim();
      
      // Check if this appears to be a reply
      const hasQuotedContent = fragments.some(f => f.isQuoted());
      const isReply = hasQuotedContent || this.hasReplyIndicators(emailBody);

      return {
        extractedText: visibleFragments,
        isReply,
        hasQuotedContent
      };
    } catch (error) {
      console.error('Failed to parse email for reply extraction:', error);
      return {
        extractedText: emailBody.trim(),
        isReply: false,
        hasQuotedContent: false
      };
    }
  }

  /**
   * Extract user text from HTML email by converting to plain text first
   */
  extractFromHtml(htmlContent: string): string {
    // Basic HTML to text conversion - strip tags and decode entities
    const textContent = this.htmlToText(htmlContent);
    return this.extractUserText(textContent);
  }

  /**
   * Check for common reply indicators
   */
  private hasReplyIndicators(text: string): boolean {
    const replyPatterns = [
      /^>\s/m,                                    // Lines starting with >
      /On .+ wrote:/i,                            // "On [date], [name] wrote:"
      /From:\s*.+\nSent:\s*.+\nTo:\s*.+/i,      // Outlook style headers
      /-----\s*Original Message\s*-----/i,       // Original message separator
      /_{10,}/,                                   // Long underscores
      /-{10,}/,                                   // Long dashes
      /\n\s*From:\s+.+\s+<.+@.+>/,              // Email headers
    ];

    return replyPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Basic HTML to text converter
   */
  private htmlToText(html: string): string {
    // Remove script and style tags with their content
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Replace <br> and <p> tags with newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<p[^>]*>/gi, '');
    
    // Replace &nbsp; with space
    text = text.replace(/&nbsp;/gi, ' ');
    
    // Remove all other HTML tags
    text = text.replace(/<[^>]+>/g, '');
    
    // Decode common HTML entities
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    
    // Clean up excessive whitespace
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    text = text.trim();
    
    return text;
  }

  /**
   * Test the extraction with a sample email
   */
  static testExtraction(): void {
    const extractor = new ReplyExtractor();
    
    const sampleEmail = `Thanks for the invite!

> The birthday is Saturday
>> When is the birthday?`;

    const result = extractor.extractUserText(sampleEmail);
    console.log('Sample extraction result:', result);
    console.log('Expected: "Thanks for the invite!"');
    console.log('Match:', result === 'Thanks for the invite!');
  }
}

// Export singleton instance
export const replyExtractor = new ReplyExtractor();