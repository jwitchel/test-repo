import { simpleParser, ParsedMail } from 'mailparser';

export interface ParsedEmailContent {
  messageId: string;
  from: string;
  to: string[];
  sentDate: Date;
  userTextPlain: string;    // Plain text version of what user wrote
  userTextRich?: string;    // HTML/Rich text version if available
}

export class EmailContentParser {
  /**
   * Extract text content from raw email data
   */
  async parseFromRaw(rawEmail: string | Buffer): Promise<ParsedEmailContent> {
    try {
      const parsed = await simpleParser(rawEmail);
      return this.parseFromMailparser(parsed);
    } catch (error) {
      throw new Error(`Failed to parse email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract text content from already parsed email
   */
  parseFromMailparser(parsedMail: ParsedMail): ParsedEmailContent {
    // Extract basic metadata
    const messageId = parsedMail.messageId || `generated-${Date.now()}`;
    const from = this.extractFromAddress(parsedMail);
    const to = this.extractToAddresses(parsedMail);
    const sentDate = parsedMail.date || new Date();

    // Extract text content
    const userTextPlain = parsedMail.text || '';
    const userTextRich = parsedMail.html || undefined;

    return {
      messageId,
      from,
      to,
      sentDate,
      userTextPlain,
      userTextRich
    };
  }

  /**
   * Extract sender email address
   */
  private extractFromAddress(parsedMail: ParsedMail): string {
    if (!parsedMail.from) {
      return 'unknown@email.com';
    }

    const from = parsedMail.from as any;
    
    // Handle text format
    if (typeof from === 'object' && 'text' in from) {
      // Extract email from "Name <email@example.com>" format
      const match = from.text.match(/<(.+?)>/);
      return match ? match[1] : from.text;
    }

    // Handle array of addresses
    if (Array.isArray(from) && from.length > 0) {
      return from[0].address || 'unknown@email.com';
    }

    // Handle single address object
    if (from && from.value && Array.isArray(from.value) && from.value.length > 0) {
      return from.value[0].address || 'unknown@email.com';
    }

    return 'unknown@email.com';
  }

  /**
   * Extract recipient email addresses
   */
  private extractToAddresses(parsedMail: ParsedMail): string[] {
    const addresses: string[] = [];

    if (parsedMail.to) {
      const toField = parsedMail.to as any;
      
      // Handle text format
      if (typeof toField === 'object' && 'text' in toField) {
        // Extract all emails from comma-separated string
        const matches = toField.text.match(/<(.+?)>/g);
        if (matches) {
          addresses.push(...matches.map((m: string) => m.slice(1, -1)));
        } else {
          // Simple email without angle brackets
          addresses.push(...toField.text.split(',').map((e: string) => e.trim()));
        }
      } 
      // Handle array format
      else if (Array.isArray(toField)) {
        addresses.push(...toField.map((addr: any) => addr.address || '').filter(Boolean));
      }
      // Handle object with value array
      else if (toField && toField.value && Array.isArray(toField.value)) {
        addresses.push(...toField.value.map((addr: any) => addr.address || '').filter(Boolean));
      }
    }

    return addresses.length > 0 ? addresses : ['unknown@email.com'];
  }
}

// Export singleton instance
export const emailContentParser = new EmailContentParser();