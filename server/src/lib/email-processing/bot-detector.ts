/**
 * Bot Detector Service
 * Deterministic detection of automated/bot email senders
 * Uses ONLY the bot_senders table - no header heuristics
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

interface KnownBotSender {
  companyName: string;
  category: string;
}

export class BotDetector {
  /**
   * Check if email is from a known bot/automated sender
   * Uses ONLY the bot_senders table for detection
   */
  async checkBot(params: BotCheckParams): Promise<BotCheckResult> {
    const { senderEmail } = params;

    const senderResult = await this._checkKnownBotSender(senderEmail);
    if (senderResult) {
      return {
        isBot: true,
        indicators: [`Known bot: ${senderResult.companyName} (${senderResult.category})`],
        companyName: senderResult.companyName,
        category: senderResult.category,
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
