/**
 * Bot Detector Service
 * Deterministic detection of automated/bot email senders
 * Uses regex patterns from bot_senders table with domain-based filtering
 */

import { pool } from '../db';

export interface BotCheckParams {
  senderEmail: string;
}

export interface BotCheckResult {
  isBot: boolean;
  indicators: string[];  // Key indicators explaining why detected as bot
  companyName?: string;
  category?: string;
}

interface BotPatternMatch {
  companyName: string;
  category: string;
  pattern: string;
}

export class BotDetector {
  /**
   * Check if email is from a known bot/automated sender
   * Uses regex patterns with domain-based filtering for performance
   */
  async checkBot(params: BotCheckParams): Promise<BotCheckResult> {
    const { senderEmail } = params;

    const matchResult = await this._checkBotPatterns(senderEmail);
    if (matchResult) {
      return {
        isBot: true,
        indicators: [`Known bot: ${matchResult.companyName} (${matchResult.category})`],
        companyName: matchResult.companyName,
        category: matchResult.category,
      };
    }

    return { isBot: false, indicators: [] };
  }

  /**
   * Check if sender matches any bot patterns
   * Queries both exact domain and root domain for wildcard pattern support
   */
  private async _checkBotPatterns(email: string): Promise<BotPatternMatch | null> {
    const emailLower = email.toLowerCase();
    const domain = extractDomainFromEmail(emailLower);
    const rootDomain = extractRootDomain(domain);

    // Query for both exact domain and root domain (for wildcard patterns)
    const domainsToQuery = rootDomain !== domain
      ? [domain, rootDomain]
      : [domain];

    const result = await pool.query(
      `SELECT email_pattern, company_name, category FROM bot_senders
       WHERE domain = ANY($1) AND is_confirmed = true`,
      [domainsToQuery]
    );

    // Test each pattern against the email
    for (const row of result.rows) {
      try {
        const regex = new RegExp(row.email_pattern, 'i');
        if (regex.test(emailLower)) {
          return {
            companyName: row.company_name,
            category: row.category,
            pattern: row.email_pattern,
          };
        }
      } catch {
        // Invalid regex pattern - skip it
        console.warn('[BotDetector] Invalid regex pattern: %s', row.email_pattern);
      }
    }

    return null;
  }
}

// Singleton instance
let botDetector: BotDetector | null = null;

/**
 * Get the BotDetector singleton instance
 */
export function getBotDetector(): BotDetector {
  if (!botDetector) {
    botDetector = new BotDetector();
  }
  return botDetector;
}

// ============================================================================
// Domain Utilities - shared by bot-detector and bot-senders routes
// ============================================================================

/**
 * Extract domain from email address
 * foo@example.com → example.com
 */
export function extractDomainFromEmail(email: string): string {
  const atIndex = email.indexOf('@');
  return email.substring(atIndex + 1);
}

/**
 * Extract root domain (last two parts) from a domain
 * email.amazon.com → amazon.com
 * gc.email.amazon.com → amazon.com
 * amazon.com → amazon.com
 */
export function extractRootDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length <= 2) {
    return domain;
  }
  return parts.slice(-2).join('.');
}

/**
 * Extract domain from email pattern (handles regex wildcards)
 * For wildcard patterns like `.*@.*\.amazon.com`, extracts the literal root domain `amazon.com`
 * For exact patterns like `no-reply@amazon.com`, extracts `amazon.com`
 * Returns null if pattern doesn't contain @
 */
export function extractDomainFromPattern(pattern: string): string | null {
  const atIndex = pattern.indexOf('@');
  if (atIndex === -1) {
    return null;
  }
  const domainPart = pattern.substring(atIndex + 1).toLowerCase();

  // If domain part contains regex wildcards, extract the literal suffix
  if (domainPart.includes('.*') || domainPart.includes('\\')) {
    const cleaned = domainPart
      .replace(/\.\*/g, '')      // Remove .*
      .replace(/\\\./g, '.')     // \. → .
      .replace(/^\.+/, '');      // Remove leading dots

    return extractRootDomain(cleaned);
  }

  return domainPart;
}
