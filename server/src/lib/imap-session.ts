import { ImapOperations, EmailMessage, EmailMessageWithRaw, EmailFolder, SearchCriteria } from './imap-operations';

interface PerformanceMetrics {
  startTime: number;
  operations: Array<{
    name: string;
    startTime: number;
    endTime: number;
    duration: number;
  }>;
  totalDuration: number;
  connectionReused: boolean;
}

/**
 * ImapSession maintains a single IMAP connection across multiple operations
 * This significantly improves performance by avoiding connection overhead
 */
export class ImapSession {
  private operations: ImapOperations;
  private isInitialized: boolean = false;
  private operationCount: number = 0;
  private metrics: PerformanceMetrics;

  constructor(operations: ImapOperations) {
    this.operations = operations;
    this.metrics = {
      startTime: Date.now(),
      operations: [],
      totalDuration: 0,
      connectionReused: false
    };
  }

  /**
   * Track an operation for performance monitoring
   */
  private async trackOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await operation();
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.metrics.operations.push({
        name,
        startTime,
        endTime,
        duration
      });
      
      // Log slow operations
      if (duration > 1000) {
        console.warn(`⚠️ Slow IMAP operation: ${name} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.metrics.operations.push({
        name: `${name} (failed)`,
        startTime,
        endTime,
        duration
      });
      
      throw error;
    }
  }

  /**
   * Create a new session from account ID
   */
  static async fromAccountId(accountId: string, userId: string): Promise<ImapSession> {
    const operations = await ImapOperations.fromAccountId(accountId, userId);
    return new ImapSession(operations);
  }

  /**
   * Initialize the session (establishes connection)
   */
  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      // Test connection to establish it
      await this.trackOperation('initialize', async () => {
        await this.operations.testConnection(true); // preserve connection
      });
      this.isInitialized = true;
      this.metrics.connectionReused = true; // Connection will be reused for subsequent operations
    }
  }

  /**
   * Get folder message count - preserves connection
   */
  async getFolderMessageCount(folderName: string): Promise<{ total: number; unseen: number }> {
    await this.initialize();
    this.operationCount++;
    return this.trackOperation(`getFolderMessageCount(${folderName})`, () => 
      this.operations.getFolderMessageCount(folderName, true)
    );
  }

  /**
   * Get folders - preserves connection
   */
  async getFolders(): Promise<EmailFolder[]> {
    await this.initialize();
    this.operationCount++;
    return this.operations.getFolders(true);
  }

  /**
   * Get messages - preserves connection
   */
  async getMessages(
    folderName: string,
    options: {
      limit?: number;
      offset?: number;
      sort?: 'date' | 'from' | 'subject';
      descending?: boolean;
    } = {}
  ): Promise<EmailMessage[]> {
    await this.initialize();
    this.operationCount++;
    return this.operations.getMessages(folderName, { ...options, preserveConnection: true });
  }

  /**
   * Search messages - preserves connection
   */
  async searchMessages(
    folderName: string,
    criteria: SearchCriteria,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<EmailMessage[]> {
    await this.initialize();
    this.operationCount++;
    return this.trackOperation(`searchMessages(${folderName})`, () => 
      this.operations.searchMessages(folderName, criteria, { ...options, preserveConnection: true })
    );
  }

  /**
   * Get single message - preserves connection
   */
  async getMessage(folderName: string, uid: number): Promise<EmailMessage & { body?: string; parsed?: any; rawMessage?: string }> {
    await this.initialize();
    this.operationCount++;
    return this.operations.getMessage(folderName, uid, true);
  }

  /**
   * Get message without parsing - preserves connection
   */
  async getMessageRaw(folderName: string, uid: number): Promise<EmailMessageWithRaw> {
    await this.initialize();
    this.operationCount++;
    return this.operations.getMessageRaw(folderName, uid, true);
  }

  /**
   * Get multiple messages without parsing in batch - preserves connection
   * This is much faster than calling getMessageRaw multiple times
   */
  async getMessagesRaw(folderName: string, uids: number[]): Promise<EmailMessageWithRaw[]> {
    await this.initialize();
    this.operationCount++; // Count as single operation even though it fetches multiple
    return this.trackOperation(`getMessagesRaw(${folderName}, ${uids.length} UIDs)`, () => 
      this.operations.getMessagesRaw(folderName, uids, true)
    );
  }

  /**
   * Mark message as read - preserves connection
   */
  async markAsRead(folderName: string, uid: number): Promise<void> {
    await this.initialize();
    this.operationCount++;
    return this.operations.markAsRead(folderName, uid, true);
  }

  /**
   * Mark message as unread - preserves connection
   */
  async markAsUnread(folderName: string, uid: number): Promise<void> {
    await this.initialize();
    this.operationCount++;
    return this.operations.markAsUnread(folderName, uid, true);
  }

  /**
   * Delete message - preserves connection
   */
  async deleteMessage(folderName: string, uid: number): Promise<void> {
    await this.initialize();
    this.operationCount++;
    return this.operations.deleteMessage(folderName, uid, true);
  }

  /**
   * Find draft folder - preserves connection
   */
  async findDraftFolder(): Promise<string> {
    await this.initialize();
    this.operationCount++;
    return this.operations.findDraftFolder(true);
  }

  /**
   * Create folder - preserves connection
   */
  async createFolder(folderPath: string): Promise<void> {
    await this.initialize();
    this.operationCount++;
    return this.operations.createFolder(folderPath, true);
  }

  /**
   * Append message to folder - preserves connection
   */
  async appendMessage(
    folderName: string,
    messageContent: string,
    flags?: string[]
  ): Promise<void> {
    await this.initialize();
    this.operationCount++;
    return this.operations.appendMessage(folderName, messageContent, flags, true);
  }

  /**
   * Move message between folders - preserves connection
   */
  async moveMessage(
    sourceFolder: string,
    destFolder: string,
    uid: number,
    flags?: string[]
  ): Promise<void> {
    await this.initialize();
    this.operationCount++;
    return this.operations.moveMessage(sourceFolder, destFolder, uid, flags, true);
  }

  /**
   * Find message by Message-ID - preserves connection
   */
  async findMessageByMessageId(folderName: string, messageId: string): Promise<number | null> {
    await this.initialize();
    this.operationCount++;
    return this.operations.findMessageByMessageId(folderName, messageId, true);
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSync(): Promise<void> {
    return this.operations.updateLastSync();
  }

  /**
   * Get the number of operations performed in this session
   */
  getOperationCount(): number {
    return this.operationCount;
  }

  /**
   * Get performance metrics for this session
   */
  getMetrics(): PerformanceMetrics & { operationCount: number; avgOperationTime: number } {
    const totalDuration = Date.now() - this.metrics.startTime;
    const avgOperationTime = this.metrics.operations.length > 0 
      ? this.metrics.operations.reduce((sum, op) => sum + op.duration, 0) / this.metrics.operations.length
      : 0;
    
    return {
      ...this.metrics,
      totalDuration,
      operationCount: this.operationCount,
      avgOperationTime
    };
  }

  /**
   * Close the session and release the connection
   */
  async close(): Promise<void> {
    if (this.isInitialized) {
      const metrics = this.getMetrics();
      this.operations.release();
      this.isInitialized = false;
      
      // Log session summary
      console.log(`📊 ImapSession Performance Summary:`);
      console.log(`  - Operations: ${metrics.operationCount}`);
      console.log(`  - Total Duration: ${metrics.totalDuration}ms`);
      console.log(`  - Avg Operation Time: ${Math.round(metrics.avgOperationTime)}ms`);
      console.log(`  - Connection Reused: ${metrics.connectionReused}`);
      
      if (metrics.operations.length > 0) {
        const slowest = metrics.operations.reduce((prev, curr) => 
          curr.duration > prev.duration ? curr : prev
        );
        console.log(`  - Slowest Operation: ${slowest.name} (${slowest.duration}ms)`);
      }
    }
  }

  /**
   * Ensure connection is closed on errors
   */
  async closeOnError(): Promise<void> {
    try {
      await this.close();
    } catch (err) {
      console.error('Error closing ImapSession:', err);
    }
  }
}