import { ImapConnection, ImapConnectionError } from './imap-connection';
import { imapPool } from './imap-pool';
import { decryptPassword, decrypt, encrypt } from './crypto';
import { pool } from '../server';
import { simpleParser } from 'mailparser';
import { OAuthTokenService } from './oauth-token-service';

export interface EmailAccountConfig {
  id: string;
  userId: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPasswordEncrypted?: string;
  imapSecure?: boolean;
  oauthProvider?: string;
  oauthRefreshToken?: string;
  oauthAccessToken?: string;
  oauthTokenExpiresAt?: Date;
}

export interface EmailFolder {
  name: string;
  path: string;
  delimiter: string;
  flags: string[];
  messageCount?: number;
  unseenCount?: number;
}

export interface EmailMessage {
  uid: number;
  messageId?: string;
  from?: string;
  to?: string[];
  subject?: string;
  date?: Date;
  flags: string[];
  size?: number;
  preview?: string;
}

export interface SearchCriteria {
  seen?: boolean;
  unseen?: boolean;
  flagged?: boolean;
  unflagged?: boolean;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  before?: Date;
  since?: Date;
  larger?: number;
  smaller?: number;
}

export class ImapOperations {
  private account: EmailAccountConfig;
  private connection: ImapConnection | null = null;

  constructor(account: EmailAccountConfig) {
    this.account = account;
  }

  static async fromAccountId(accountId: string, userId: string): Promise<ImapOperations> {
    const result = await pool.query(
      `SELECT id, user_id, email_address, imap_host, imap_port, 
              imap_username, imap_password_encrypted,
              oauth_provider, oauth_refresh_token, oauth_access_token,
              oauth_token_expires_at
       FROM email_accounts 
       WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    );

    if (result.rows.length === 0) {
      throw new ImapConnectionError('Email account not found', 'ACCOUNT_NOT_FOUND');
    }

    const row = result.rows[0];
    const account: EmailAccountConfig = {
      id: row.id,
      userId: row.user_id,
      email: row.email_address,
      imapHost: row.imap_host,
      imapPort: row.imap_port,
      imapUsername: row.imap_username,
      imapPasswordEncrypted: row.imap_password_encrypted,
      imapSecure: row.imap_port === 993 || row.imap_port === 995,
      oauthProvider: row.oauth_provider,
      oauthRefreshToken: row.oauth_refresh_token,
      oauthAccessToken: row.oauth_access_token,
      oauthTokenExpiresAt: row.oauth_token_expires_at
    };

    return new ImapOperations(account);
  }

  private async getConnection(): Promise<ImapConnection> {
    if (!this.connection) {
      let config: any = {
        user: this.account.imapUsername,
        host: this.account.imapHost,
        port: this.account.imapPort,
        tls: this.account.imapSecure
      };

      // Use OAuth2 if available
      if (this.account.oauthProvider && this.account.oauthAccessToken) {
        console.log('Using OAuth2 authentication for:', this.account.email);
        
        let accessToken = decrypt(this.account.oauthAccessToken);
        
        // Check if token needs refresh
        if (this.account.oauthTokenExpiresAt && 
            OAuthTokenService.needsRefresh(this.account.oauthTokenExpiresAt)) {
          console.log('OAuth token expired, refreshing...');
          
          if (!this.account.oauthRefreshToken) {
            throw new ImapConnectionError('OAuth refresh token not available', 'AUTH_REFRESH_TOKEN_MISSING');
          }
          
          try {
            const refreshToken = decrypt(this.account.oauthRefreshToken);
            const newTokens = await OAuthTokenService.refreshTokens(
              refreshToken,
              this.account.oauthProvider,
              this.account.id
            );
            
            // Update the access token for this connection
            accessToken = newTokens.accessToken;
            
            // Update the account object with new token info
            this.account.oauthAccessToken = encrypt(newTokens.accessToken);
            this.account.oauthTokenExpiresAt = newTokens.expiresAt;
            
            console.log('OAuth token refreshed successfully');
          } catch (error) {
            console.error('Failed to refresh OAuth token:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new ImapConnectionError(
              `OAuth token refresh failed: ${errorMessage}`, 
              'AUTH_REFRESH_FAILED'
            );
          }
        }

        // Generate XOAUTH2 string with the (possibly refreshed) access token
        const xoauth2 = OAuthTokenService.generateXOAuth2Token(
          this.account.email,
          accessToken
        );
        
        console.log('Generated XOAuth2 token for:', this.account.email);
        console.log('XOAuth2 token length:', xoauth2.length);
        
        config.xoauth2 = xoauth2;
        // Remove password field to ensure OAuth is used
        delete config.password;
      } else if (this.account.imapPasswordEncrypted) {
        // Fall back to password authentication
        const password = decryptPassword(this.account.imapPasswordEncrypted);
        config.password = password;
      } else {
        throw new ImapConnectionError('No authentication method available', 'AUTH_MISSING');
      }

      this.connection = await imapPool.getConnection(
        config,
        this.account.userId,
        this.account.id
      );
    }

    return this.connection;
  }

  async testConnection(): Promise<boolean> {
    try {
      const conn = await this.getConnection();
      
      // Try to list folders as a test
      await conn.listFolders();
      
      return true;
    } catch (error) {
      console.error('IMAP connection test failed:', error);
      return false;
    } finally {
      this.release();
    }
  }

  async getFolders(): Promise<EmailFolder[]> {
    const conn = await this.getConnection();
    
    try {
      const imapFolders = await conn.listFolders();
      const folders: EmailFolder[] = [];

      // Get message counts for each folder
      for (const imapFolder of imapFolders) {
        try {
          const box = await conn.selectFolder(imapFolder.name);
          
          folders.push({
            name: imapFolder.name,
            path: imapFolder.name,
            delimiter: imapFolder.delimiter,
            flags: imapFolder.flags,
            messageCount: box.messages.total,
            unseenCount: box.messages.unseen
          });
        } catch (err) {
          // If we can't select the folder, add it without counts
          folders.push({
            name: imapFolder.name,
            path: imapFolder.name,
            delimiter: imapFolder.delimiter,
            flags: imapFolder.flags
          });
        }
      }

      return folders;
    } finally {
      this.release();
    }
  }

  async getMessages(
    folderName: string,
    options: {
      limit?: number;
      offset?: number;
      sort?: 'date' | 'from' | 'subject';
      descending?: boolean;
    } = {}
  ): Promise<EmailMessage[]> {
    const conn = await this.getConnection();
    
    try {
      await conn.selectFolder(folderName);
      
      // Search for all messages
      const uids = await conn.search(['ALL']);
      
      if (uids.length === 0) {
        return [];
      }

      // Apply sorting and pagination
      let sortedUids = [...uids];
      if (options.descending !== false) {
        sortedUids.reverse(); // Default to newest first
      }

      const offset = options.offset || 0;
      const limit = options.limit || 50;
      const paginatedUids = sortedUids.slice(offset, offset + limit);

      if (paginatedUids.length === 0) {
        return [];
      }

      // Fetch message details
      // Fetch messages individually as the test mail server doesn't handle bulk UID fetches
      const messages: any[] = [];
      
      for (const uid of paginatedUids) {
        try {
          const fetchedMessages = await conn.fetch(uid, {
            bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)',
            envelope: true,
            size: true,
            flags: true
          });
          if (fetchedMessages.length > 0) {
            messages.push(...fetchedMessages);
          }
        } catch (err) {
          console.error(`Error fetching UID ${uid}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      return messages.map((msg: any) => ({
        uid: msg.uid,
        messageId: msg.headers?.messageId?.[0],
        from: msg.headers?.from?.[0],
        to: msg.headers?.to,
        subject: msg.headers?.subject?.[0],
        date: msg.date,
        flags: msg.flags,
        size: msg.size
      }));
    } finally {
      this.release();
    }
  }

  async searchMessages(
    folderName: string,
    criteria: SearchCriteria,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<EmailMessage[]> {
    const conn = await this.getConnection();
    
    try {
      await conn.selectFolder(folderName);
      
      // Build IMAP search criteria
      const imapCriteria: any[] = [];
      
      if (criteria.seen !== undefined) {
        imapCriteria.push(criteria.seen ? 'SEEN' : 'UNSEEN');
      }
      if (criteria.flagged !== undefined) {
        imapCriteria.push(criteria.flagged ? 'FLAGGED' : 'UNFLAGGED');
      }
      if (criteria.from) {
        imapCriteria.push(['FROM', criteria.from]);
      }
      if (criteria.to) {
        imapCriteria.push(['TO', criteria.to]);
      }
      if (criteria.subject) {
        imapCriteria.push(['SUBJECT', criteria.subject]);
      }
      if (criteria.body) {
        imapCriteria.push(['BODY', criteria.body]);
      }
      if (criteria.before) {
        imapCriteria.push(['BEFORE', criteria.before]);
      }
      if (criteria.since) {
        imapCriteria.push(['SINCE', criteria.since]);
      }
      if (criteria.larger) {
        imapCriteria.push(['LARGER', criteria.larger]);
      }
      if (criteria.smaller) {
        imapCriteria.push(['SMALLER', criteria.smaller]);
      }

      // Default to ALL if no criteria
      if (imapCriteria.length === 0) {
        imapCriteria.push('ALL');
      }

      const uids = await conn.search(imapCriteria);
      console.log(`IMAP search with criteria ${JSON.stringify(imapCriteria)} returned ${uids.length} UIDs`);
      
      if (uids.length === 0) {
        return [];
      }

      // Sort UIDs in descending order to get newest emails first
      const sortedUids = [...uids].sort((a, b) => b - a);

      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || 50;
      const paginatedUids = sortedUids.slice(offset, offset + limit);
      console.log(`Pagination: offset=${offset}, limit=${limit}, paginatedUids.length=${paginatedUids.length}`);

      if (paginatedUids.length === 0) {
        return [];
      }

      // Fetch message details
      console.log(`Fetching UIDs: ${paginatedUids.slice(0, 10).join(',')}... (total: ${paginatedUids.length})`);
      
      // Workaround: Fetch messages individually
      // The test mail server doesn't handle bulk UID fetches properly
      const messages: any[] = [];
      
      for (const uid of paginatedUids) {
        try {
          const fetchedMessages = await conn.fetch(uid, {
            bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)',
            envelope: true,
            size: true,
            flags: true
          });
          if (fetchedMessages.length > 0) {
            messages.push(...fetchedMessages);
          }
        } catch (err) {
          console.error(`Error fetching UID ${uid}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      
      console.log(`Total fetched ${messages.length} messages from IMAP`);

      return messages.map((msg: any) => ({
        uid: msg.uid,
        messageId: msg.headers?.messageId?.[0],
        from: msg.headers?.from?.[0],
        to: msg.headers?.to,
        subject: msg.headers?.subject?.[0],
        date: msg.date,
        flags: msg.flags,
        size: msg.size
      }));
    } finally {
      this.release();
    }
  }

  async getMessage(folderName: string, uid: number): Promise<EmailMessage & { body?: string; parsed?: any }> {
    const conn = await this.getConnection();
    
    try {
      await conn.selectFolder(folderName);
      
      const messages = await conn.fetch(uid.toString(), {
        bodies: '',
        envelope: true,
        size: true,
        flags: true
      });

      if (messages.length === 0) {
        throw new ImapConnectionError('Message not found', 'MESSAGE_NOT_FOUND');
      }

      const msg = messages[0];
      
      // Parse the message if we have a body
      let parsed = null;
      if (msg.body) {
        parsed = await simpleParser(msg.body);
      }
      
      return {
        uid: msg.uid,
        messageId: msg.headers?.messageId?.[0],
        from: msg.headers?.from?.[0],
        to: msg.headers?.to,
        subject: msg.headers?.subject?.[0],
        date: msg.date,
        flags: msg.flags,
        size: msg.size,
        body: msg.body,
        parsed
      };
    } finally {
      this.release();
    }
  }

  async markAsRead(folderName: string, uid: number): Promise<void> {
    const conn = await this.getConnection();
    
    try {
      await conn.selectFolder(folderName);
      
      // Add the \Seen flag
      await new Promise<void>((resolve, reject) => {
        (conn as any).imap.addFlags(uid, '\\Seen', (err: Error) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } finally {
      this.release();
    }
  }

  async markAsUnread(folderName: string, uid: number): Promise<void> {
    const conn = await this.getConnection();
    
    try {
      await conn.selectFolder(folderName);
      
      // Remove the \Seen flag
      await new Promise<void>((resolve, reject) => {
        (conn as any).imap.delFlags(uid, '\\Seen', (err: Error) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } finally {
      this.release();
    }
  }

  async deleteMessage(folderName: string, uid: number): Promise<void> {
    const conn = await this.getConnection();
    
    try {
      await conn.selectFolder(folderName);
      
      // Add the \Deleted flag
      await new Promise<void>((resolve, reject) => {
        (conn as any).imap.addFlags(uid, '\\Deleted', (err: Error) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Expunge to permanently delete
      await new Promise<void>((resolve, reject) => {
        (conn as any).imap.expunge((err: Error) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } finally {
      this.release();
    }
  }

  async startIdleMonitoring(folderName: string, callback: (event: any) => void): Promise<void> {
    const conn = await this.getConnection();
    
    await conn.selectFolder(folderName);
    
    conn.on('mail', (numNewMsgs: number) => {
      callback({ type: 'new_mail', count: numNewMsgs });
    });

    conn.on('expunge', (seqno: number) => {
      callback({ type: 'expunge', seqno });
    });

    await conn.idle();
  }

  stopIdleMonitoring(): void {
    if (this.connection) {
      this.connection.stopIdle();
    }
  }

  release(): void {
    if (this.connection) {
      imapPool.releaseConnection(
        this.connection,
        this.account.userId,
        this.account.id
      );
      this.connection = null;
    }
  }

  async updateLastSync(): Promise<void> {
    await pool.query(
      'UPDATE email_accounts SET last_sync = CURRENT_TIMESTAMP WHERE id = $1',
      [this.account.id]
    );
  }
}