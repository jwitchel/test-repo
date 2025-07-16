import EmailReplyParser from 'email-reply-parser';
import { convert as htmlToText } from 'html-to-text';

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
      // Pre-process to handle special quote patterns that email-reply-parser misses
      const preprocessed = this.preprocessQuotePatterns(emailBody);
      
      // Parse the email body
      const parsed = this.parser.read(preprocessed);
      
      // Post-process fragments to handle code continuation issues
      const fragments = this.mergeCodeContinuations(parsed.getFragments());
      
      // Get only the non-quoted fragments
      // We now check both isQuoted() and isHidden() but with special handling
      const visibleFragments = fragments
        .filter(fragment => {
          // Always exclude quoted fragments
          if (fragment.isQuoted()) return false;
          
          // For hidden fragments, check if it's actually a quote pattern
          if (fragment.isHidden()) {
            const content = fragment.getContent();
            return !this.isQuotePattern(content);
          }
          
          return true;
        })
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
      // Pre-process to handle special quote patterns
      const preprocessed = this.preprocessQuotePatterns(emailBody);
      
      const parsed = this.parser.read(preprocessed);
      const fragments = this.mergeCodeContinuations(parsed.getFragments());
      
      // Get only the non-quoted fragments with special handling for hidden fragments
      const visibleFragments = fragments
        .filter(fragment => {
          if (fragment.isQuoted()) return false;
          if (fragment.isHidden()) {
            return !this.isQuotePattern(fragment.getContent());
          }
          return true;
        })
        .map(fragment => fragment.getContent())
        .join('\n')
        .trim();
      
      // Check if this appears to be a reply
      const hasQuotedContent = fragments.some(f => f.isQuoted()) || 
                              fragments.some(f => f.isHidden() && this.isQuotePattern(f.getContent()));
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
    // Convert HTML to plain text using the html-to-text library
    const textContent = htmlToText(htmlContent, {
      wordwrap: false,
      preserveNewlines: true,
      selectors: [
        // Preserve line breaks from block elements
        { selector: 'p', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
        { selector: 'br', options: { leadingLineBreaks: 1 } },
        { selector: 'div', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
        { selector: 'h1', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
        { selector: 'h2', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
        { selector: 'h3', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
        { selector: 'h4', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
        { selector: 'h5', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
        { selector: 'h6', options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
        // Remove images alt text as they're not user content
        { selector: 'img', format: 'skip' },
        // Preserve link text but not URLs
        { selector: 'a', options: { ignoreHref: true } }
      ]
    });
    return this.extractUserText(textContent);
  }

  /**
   * Merge code continuation fragments that were incorrectly split
   */
  private mergeCodeContinuations(fragments: any[]): any[] {
    if (fragments.length < 2) return fragments;
    
    const merged: any[] = [];
    let i = 0;
    
    while (i < fragments.length) {
      const current = fragments[i];
      merged.push(current);
      
      // Check if the next fragment might be a code continuation
      if (i + 1 < fragments.length && current.isQuoted()) {
        const next = fragments[i + 1];
        
        // If the next fragment is non-quoted, starts with spaces, and looks like code
        if (!next.isQuoted() && 
            !next.isHidden() && 
            this.looksLikeCodeContinuation(next.getContent())) {
          
          // Check if there's a pattern suggesting this is a continuation
          const currentContent = current.getContent();
          const nextContent = next.getContent();
          
          // If the current fragment ends with an opening brace or incomplete statement
          if (this.isIncompleteCodeBlock(currentContent)) {
            // Merge the next fragment into the current one
            current._content = currentContent + '\n' + nextContent;
            i++; // Skip the next fragment since we merged it
          }
        }
      }
      
      i++;
    }
    
    return merged;
  }

  /**
   * Check if text looks like a code continuation
   */
  private looksLikeCodeContinuation(text: string): boolean {
    // Starts with 2+ spaces (common code indentation)
    if (!/^\s{2,}/.test(text)) return false;
    
    // Contains common code patterns
    const codePatterns = [
      /console\.log/,
      /function/,
      /return/,
      /[{}();]/,
      /\w+\s*\(/,  // function calls
      /['"]/       // strings
    ];
    
    return codePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if a code block appears incomplete
   */
  private isIncompleteCodeBlock(text: string): boolean {
    // Count opening and closing braces
    const openBraces = (text.match(/{/g) || []).length;
    const closeBraces = (text.match(/}/g) || []).length;
    
    // If there are more opening than closing braces, it's incomplete
    if (openBraces > closeBraces) return true;
    
    // Check if it ends with common incomplete patterns
    const incompletePatterns = [
      /{\s*$/,           // ends with opening brace
      /\(\s*$/,          // ends with opening parenthesis
      /,\s*$/,           // ends with comma
      /\|\|\s*$/,        // ends with OR operator
      /&&\s*$/,          // ends with AND operator
      /=\s*$/,           // ends with assignment
    ];
    
    return incompletePatterns.some(pattern => pattern.test(text.trim()));
  }

  /**
   * Pre-process email to handle special quote patterns
   */
  private preprocessQuotePatterns(emailBody: string): string {
    // Replace Outlook-style quotes with standard quote markers
    let processed = emailBody;
    
    // Handle "-----Original Message-----" pattern
    processed = processed.replace(
      /(\n|^)-----\s*Original Message\s*-----[\s\S]*/i,
      '\n> [Quoted content removed]'
    );
    
    // Handle "---------- Forwarded message ---------" pattern
    processed = processed.replace(
      /(\n|^)-{5,}\s*Forwarded message\s*-{5,}[\s\S]*/i,
      '\n> [Forwarded content removed]'
    );
    
    return processed;
  }

  /**
   * Check if a hidden fragment is actually a quote pattern
   */
  private isQuotePattern(content: string): boolean {
    const quotePatterns = [
      /^-----\s*Original Message\s*-----/i,
      /^-{5,}\s*Forwarded message\s*-{5,}/i,
      /^From:\s*.+\nSent:\s*.+\nTo:\s*.+\nSubject:/i,
      /^On .+ wrote:$/i
    ];
    
    return quotePatterns.some(pattern => pattern.test(content.trim()));
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