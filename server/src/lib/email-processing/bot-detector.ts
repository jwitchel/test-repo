/**
 * Bot Detector Service
 * Deterministic detection of automated/bot email senders
 * No LLM or heuristics - uses email headers and known senders list only
 */

import { pool } from '../db';

export interface BotCheckParams {
  senderEmail: string;
  fullMessage: string;
}

export interface BotCheckResult {
  isBot: boolean;
  indicators: string[];  // Key indicators explaining why detected as bot
  companyName?: string;
  category?: string;
}

interface KnownBotSender {
  companyName: string;
  category: string;
}

export class BotDetector {
  /**
   * Check if email is from a known bot/automated sender
   * Deterministic detection - no LLM, no heuristics
   *
   * Detection order:
   * 1. Known bot senders list (direct DB lookup on indexed column)
   * 2. Email headers (List-Unsubscribe, Precedence: bulk, Auto-Submitted)
   */
  async checkBot(params: BotCheckParams): Promise<BotCheckResult> {
    const { senderEmail, fullMessage } = params;

    // Step 1: Check known bot senders list (simple indexed lookup)
    const senderResult = await this._checkKnownBotSender(senderEmail);
    if (senderResult) {
      return {
        isBot: true,
        indicators: [`Known bot: ${senderResult.companyName} (${senderResult.category})`],
        companyName: senderResult.companyName,
        category: senderResult.category,
      };
    }

    // Step 2: Check headers for bot signals
    const headerResult = this._checkBotHeaders(fullMessage);
    if (headerResult.isBot) {
      return {
        isBot: true,
        indicators: headerResult.indicators,
      };
    }

    return { isBot: false, indicators: [] };
  }

  /**
   * Check if sender is in known bot senders list
   * Direct DB query on indexed email_address column (trivial lookup)
   */
  private async _checkKnownBotSender(email: string): Promise<KnownBotSender | null> {
    const result = await pool.query(
      `SELECT company_name, category FROM bot_senders
       WHERE email_address = $1 AND is_confirmed = true`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      companyName: result.rows[0].company_name,
      category: result.rows[0].category,
    };
  }

  /**
   * Check email headers for bot signals
   * Headers checked:
   * - List-Unsubscribe (RFC 2369) - Strong signal of bulk/automated mail
   * - Precedence: bulk or list - Standard bulk mail indicator
   * - Auto-Submitted: auto-generated - RFC 3834 automated mail indicator
   * - X-Auto-Response-Suppress - Microsoft automated mail indicator
   *
   * Requires 2+ signals to classify as bot from headers alone
   */
  private _checkBotHeaders(fullMessage: string): { isBot: boolean; indicators: string[] } {
    const indicators: string[] = [];
    let signalCount = 0;

    // Check List-Unsubscribe header (RFC 2369) - strong bot signal
    if (/^List-Unsubscribe:/im.test(fullMessage)) {
      indicators.push('Has List-Unsubscribe header');
      signalCount += 2;  // Strong signal - count as 2
    }

    // Check Precedence header (bulk, list, or junk)
    if (/^Precedence:\s*(bulk|list|junk)/im.test(fullMessage)) {
      indicators.push('Has Precedence: bulk/list header');
      signalCount += 2;  // Strong signal
    }

    // Check Auto-Submitted header (RFC 3834)
    if (/^Auto-Submitted:\s*auto-generated/im.test(fullMessage)) {
      indicators.push('Has Auto-Submitted: auto-generated header');
      signalCount += 2;  // Strong signal
    }

    // Check X-Auto-Response-Suppress (Microsoft)
    if (/^X-Auto-Response-Suppress:/im.test(fullMessage)) {
      indicators.push('Has X-Auto-Response-Suppress header');
      signalCount += 1;  // Moderate signal
    }

    // Check List-Id header (mailing list)
    if (/^List-Id:/im.test(fullMessage)) {
      indicators.push('Has List-Id header');
      signalCount += 1;  // Moderate signal
    }

    // Require 2+ signal points to classify as bot from headers alone
    // This prevents false positives from single headers
    return {
      isBot: signalCount >= 2,
      indicators,
    };
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
