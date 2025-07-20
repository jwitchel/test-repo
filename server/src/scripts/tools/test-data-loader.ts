#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { VectorStore } from '../../lib/vector/qdrant-client';
import { EmbeddingService } from '../../lib/vector/embedding-service';
import { EmailIngestPipeline } from '../../lib/pipeline/email-ingest-pipeline';
import { ProcessedEmail } from '../../lib/pipeline/types';
import { RelationshipDetector } from '../../lib/relationships/relationship-detector';
import chalk from 'chalk';

interface JohnEmail {
  id: number;
  date: string;
  recipient_type: 'wife' | 'coworker' | 'friend' | 'investor';
  subject: string;
  body: string;
  tone_profile: string;
  scenario_type: string;
  length: string;
}

interface JohnEmailFile {
  metadata: {
    file: string;
    date_range: string;
    total_emails: number;
    character: string;
    narrative_context: string;
    distribution: Record<string, number>;
  };
  emails: JohnEmail[];
}

export class TestDataLoader {
  private vectorStore: VectorStore;
  private embeddingService: EmbeddingService;
  private ingestionPipeline: EmailIngestPipeline;
  
  constructor() {
    this.vectorStore = new VectorStore();
    this.embeddingService = new EmbeddingService();
    this.ingestionPipeline = new EmailIngestPipeline(
      this.vectorStore,
      this.embeddingService,
      new RelationshipDetector(),
      { batchSize: 50, parallelism: 5, errorThreshold: 0.1 }
    );
  }
  
  async initialize(): Promise<void> {
    console.log(chalk.blue('🚀 Initializing services...'));
    await this.vectorStore.initialize();
    await this.embeddingService.initialize();
    console.log(chalk.green('✅ Services initialized'));
  }
  
  /**
   * Convert John's email format to ProcessedEmail format
   */
  private convertToProcessedEmail(email: JohnEmail, _userId: string): ProcessedEmail {
    // Map recipient types to email addresses
    const recipientEmails: Record<string, string> = {
      wife: 'lisa@example.com',
      coworker: 'sarah@company.com',
      friend: 'mike@example.com',
      investor: 'jim@venturecapital.com'
    };
    
    // Map recipient types to relationships
    const relationshipMap: Record<string, string> = {
      wife: 'spouse',
      coworker: 'colleague',
      friend: 'friend',
      investor: 'professional'
    };
    
    return {
      uid: email.id.toString(),
      messageId: `<john-email-${email.id}@example.com>`,
      inReplyTo: null,
      date: new Date(email.date),
      from: [{ address: 'john@company.com', name: 'John Mitchell' }],
      to: [{ 
        address: recipientEmails[email.recipient_type], 
        name: email.recipient_type.charAt(0).toUpperCase() + email.recipient_type.slice(1) 
      }],
      cc: [],
      bcc: [],
      subject: email.subject || '(no subject)',
      textContent: email.body,
      htmlContent: null,
      extractedText: email.body,
      relationship: {
        type: relationshipMap[email.recipient_type],
        confidence: 1.0,
        detectionMethod: 'test-data'
      }
    };
  }
  
  /**
   * Load emails from a single John's email file
   */
  async loadEmailFile(filePath: string, userId: string): Promise<void> {
    console.log(chalk.blue(`📧 Loading ${path.basename(filePath)}...`));
    
    const content = await fs.readFile(filePath, 'utf-8');
    const data: JohnEmailFile = JSON.parse(content);
    
    console.log(chalk.gray(`  - Date range: ${data.metadata.date_range}`));
    console.log(chalk.gray(`  - Total emails: ${data.metadata.total_emails}`));
    console.log(chalk.gray(`  - Context: ${data.metadata.narrative_context}`));
    
    // Convert all emails to ProcessedEmail format
    const processedEmails: ProcessedEmail[] = data.emails.map(email => 
      this.convertToProcessedEmail(email, userId)
    );
    
    // Process through ingestion pipeline
    await this.ingestionPipeline.processHistoricalEmails(
      userId,
      'john-test-account',
      processedEmails
    );
    
    console.log(chalk.green(`  ✅ Processed ${processedEmails.length} emails`));
  }
  
  /**
   * Load all John's email files
   */
  async loadAllJohnEmails(userId: string = 'john-test-user'): Promise<void> {
    const emailsDir = path.join(process.cwd(), '..', 'johns_emails');
    
    console.log(chalk.bold('\n📬 Loading John\'s Email Test Data\n'));
    
    // Get all JSON files in order
    const files = await fs.readdir(emailsDir);
    const jsonFiles = files
      .filter(f => f.endsWith('.json'))
      .sort(); // Ensures part1, part2, etc. are in order
    
    console.log(chalk.blue(`Found ${jsonFiles.length} email files to process\n`));
    
    // Process each file
    for (const file of jsonFiles) {
      await this.loadEmailFile(path.join(emailsDir, file), userId);
    }
    
    // Get statistics
    const stats = await this.vectorStore.getRelationshipStats(userId);
    console.log(chalk.bold('\n📊 Final Statistics:'));
    console.log(chalk.gray('  Emails by relationship:'));
    Object.entries(stats).forEach(([rel, count]) => {
      console.log(chalk.gray(`    - ${rel}: ${count}`));
    });
    
    console.log(chalk.green('\n✅ All John\'s emails loaded successfully!\n'));
  }
  
  /**
   * Clear all data for a user from the vector store
   */
  async clearUserData(userId: string = 'john-test-user'): Promise<void> {
    console.log(chalk.yellow(`🗑️  Clearing all data for user: ${userId}...`));
    
    try {
      await this.vectorStore.deleteUserData(userId);
      console.log(chalk.green('✅ User data cleared successfully'));
    } catch (error) {
      console.error(chalk.red('❌ Error clearing user data:'), error);
      throw error;
    }
  }
  
  /**
   * Clear and reload all test data
   */
  async resetAndLoad(userId: string = 'john-test-user'): Promise<void> {
    console.log(chalk.bold('🔄 Resetting and loading test data...\n'));
    
    await this.clearUserData(userId);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for deletion
    await this.loadAllJohnEmails(userId);
  }
}

// CLI interface
if (require.main === module) {
  const loader = new TestDataLoader();
  
  const command = process.argv[2];
  const userId = process.argv[3] || 'john-test-user';
  
  async function run() {
    try {
      await loader.initialize();
      
      switch (command) {
        case 'load':
          await loader.loadAllJohnEmails(userId);
          break;
          
        case 'clear':
          await loader.clearUserData(userId);
          break;
          
        case 'reset':
          await loader.resetAndLoad(userId);
          break;
          
        default:
          console.log(chalk.yellow('Usage:'));
          console.log('  npx tsx test-data-loader.ts load [userId]    - Load John\'s emails');
          console.log('  npx tsx test-data-loader.ts clear [userId]   - Clear user data');
          console.log('  npx tsx test-data-loader.ts reset [userId]   - Clear and reload');
          console.log('\nDefault userId: john-test-user');
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }
  
  run();
}