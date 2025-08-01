import { pool } from '../server';
import { encrypt, decrypt } from './crypto';

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export class OAuthTokenService {
  /**
   * Store OAuth tokens for an email account
   */
  static async storeTokens(
    emailAccountId: string,
    tokens: OAuthTokens,
    oauthUserId: string
  ): Promise<void> {
    const encryptedRefreshToken = encrypt(tokens.refreshToken);
    const encryptedAccessToken = encrypt(tokens.accessToken);

    await pool.query(
      `UPDATE email_accounts 
       SET oauth_refresh_token = $1,
           oauth_access_token = $2,
           oauth_token_expires_at = $3,
           oauth_user_id = $4
       WHERE id = $5`,
      [
        encryptedRefreshToken,
        encryptedAccessToken,
        tokens.expiresAt,
        oauthUserId,
        emailAccountId
      ]
    );
  }

  /**
   * Get OAuth tokens for an email account
   */
  static async getTokens(emailAccountId: string): Promise<OAuthTokens | null> {
    const result = await pool.query(
      `SELECT oauth_refresh_token, oauth_access_token, oauth_token_expires_at
       FROM email_accounts
       WHERE id = $1 AND oauth_refresh_token IS NOT NULL`,
      [emailAccountId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      refreshToken: decrypt(row.oauth_refresh_token),
      accessToken: decrypt(row.oauth_access_token),
      expiresAt: row.oauth_token_expires_at
    };
  }

  /**
   * Generate XOAUTH2 string for IMAP authentication
   * Format: base64("user=" + userName + "^Aauth=Bearer " + accessToken + "^A^A")
   */
  static generateXOAuth2Token(email: string, accessToken: string): string {
    const authString = [
      `user=${email}`,
      `auth=Bearer ${accessToken}`,
      '',
      ''
    ].join('\x01');
    
    return Buffer.from(authString).toString('base64');
  }

  /**
   * Check if token needs refresh (5 minutes before expiry)
   */
  static needsRefresh(expiresAt: Date): boolean {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    return fiveMinutesFromNow >= expiresAt;
  }

  /**
   * Refresh OAuth tokens using refresh token
   * This will need to be implemented with the specific OAuth provider
   */
  static async refreshTokens(
    _refreshToken: string,
    _provider: string
  ): Promise<OAuthTokens> {
    // TODO: Implement token refresh logic for each provider
    // For now, this is a placeholder
    throw new Error('Token refresh not yet implemented');
  }
}