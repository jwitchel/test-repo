#!/usr/bin/env node
import { VectorStore } from '../vector/qdrant-client';
import { EmbeddingService } from '../vector/embedding-service';
import { ExampleSelector } from './example-selector';
import { PromptFormatterV2 } from './prompt-formatter-v2';
import { EmailIngestPipeline } from './email-ingest-pipeline';
import { TestDataLoader } from '../../scripts/tools/test-data-loader';
import { ProcessedEmail, GeneratedDraft } from './types';
import { RelationshipService } from '../relationships/relationship-service';
import { RelationshipDetector } from '../relationships/relationship-detector';
import chalk from 'chalk';

export interface ToneLearningConfig {
  userId: string;
  maxExamples?: number;
  templateName?: string;
  verbose?: boolean;
}

export interface DraftGenerationRequest {
  incomingEmail: ProcessedEmail;
  recipientEmail: string;
  config?: Partial<ToneLearningConfig>;
}

export class ToneLearningOrchestrator {
  private vectorStore: VectorStore;
  private embeddingService: EmbeddingService;
  private relationshipService: RelationshipService;
  private relationshipDetector: RelationshipDetector;
  private exampleSelector: ExampleSelector;
  private promptFormatter: PromptFormatterV2;
  private ingestionPipeline: EmailIngestPipeline;
  private testDataLoader: TestDataLoader;
  
  constructor() {
    this.vectorStore = new VectorStore();
    this.embeddingService = new EmbeddingService();
    this.relationshipService = new RelationshipService();
    this.relationshipDetector = new RelationshipDetector();
    this.exampleSelector = new ExampleSelector(
      this.vectorStore, 
      this.embeddingService,
      this.relationshipService,
      this.relationshipDetector
    );
    this.promptFormatter = new PromptFormatterV2();
    this.ingestionPipeline = new EmailIngestPipeline(
      this.vectorStore,
      this.embeddingService,
      this.relationshipDetector,
      { 
        batchSize: parseInt(process.env.PIPELINE_BATCH_SIZE || '100'),
        parallelism: parseInt(process.env.PIPELINE_PARALLELISM || '5'),
        errorThreshold: parseFloat(process.env.PIPELINE_ERROR_THRESHOLD || '0.1')
      }
    );
    this.testDataLoader = new TestDataLoader();
  }
  
  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    await this.embeddingService.initialize();
    await this.promptFormatter.initialize();
  }
  
  /**
   * Ingest a batch of historical emails
   */
  async ingestHistoricalEmails(
    userId: string,
    emailAccountId: string,
    emails: ProcessedEmail[]
  ): Promise<{ processed: number; errors: number; duration: number; relationshipDistribution: Record<string, number> }> {
    if (process.env.NODE_ENV !== 'test') {
      console.log(chalk.blue(`📥 Ingesting ${emails.length} historical emails...`));
    }
    
    const result = await this.ingestionPipeline.processHistoricalEmails(
      userId,
      emailAccountId,
      emails
    );
    
    if (process.env.NODE_ENV !== 'test') {
      console.log(chalk.green('✅ Historical emails ingested'));
    }
    
    return result;
  }
  
  /**
   * Generate a draft reply using learned tone
   */
  async generateDraft(request: DraftGenerationRequest): Promise<GeneratedDraft> {
    const {
      incomingEmail,
      recipientEmail,
      config = {}
    } = request;
    
    const {
      userId,
      maxExamples = parseInt(process.env.EXAMPLE_COUNT || '25'),
      templateName = 'default',
      verbose = false
    } = config;
    
    if (!userId) {
      throw new Error('userId is required in config');
    }
    
    if (verbose) {
      console.log(chalk.bold('\n🤖 Generating Draft Reply\n'));
      console.log(chalk.gray('Incoming email:'));
      console.log(chalk.gray(`  From: ${incomingEmail.from[0]?.address}`));
      console.log(chalk.gray(`  Subject: ${incomingEmail.subject}`));
      console.log(chalk.gray(`  Text: ${incomingEmail.extractedText.substring(0, 100)}...`));
    }
    
    // Step 1: Select relevant examples
    if (verbose) {
      console.log(chalk.blue('\n1️⃣ Selecting examples...'));
    }
    
    const exampleSelection = await this.exampleSelector.selectExamples({
      userId,
      incomingEmail: incomingEmail.extractedText,
      recipientEmail,
      desiredCount: maxExamples
    });
    
    // Get the detected relationship
    const detectedRelationship = await this.relationshipDetector.detectRelationship({
      userId,
      recipientEmail
    });
    
    if (verbose) {
      console.log(chalk.gray(`  Found ${exampleSelection.examples.length} relevant examples`));
      console.log(chalk.gray(`  Primary relationship: ${exampleSelection.relationship}`));
      console.log(chalk.gray(`  Confidence: ${(detectedRelationship.confidence * 100).toFixed(1)}%`));
    }
    
    // Step 2: Format prompt with examples
    if (verbose) {
      console.log(chalk.blue('\n2️⃣ Formatting prompt...'));
    }
    
    const prompt = await this.promptFormatter.formatWithExamples({
      incomingEmail: incomingEmail.extractedText,
      recipientEmail,
      examples: exampleSelection.examples,
      relationship: exampleSelection.relationship
    });
    
    if (verbose) {
      console.log(chalk.gray(`  Template: ${templateName}`));
      console.log(chalk.gray(`  Prompt length: ${prompt.length} characters`));
    }
    
    // Step 3: Generate draft (placeholder for actual LLM call)
    if (verbose) {
      console.log(chalk.blue('\n3️⃣ Generating draft...'));
    }
    
    // TODO: Integrate with actual LLM service
    const draft: GeneratedDraft = {
      id: `draft-${Date.now()}`,
      userId,
      incomingEmailId: incomingEmail.uid,
      recipientEmail,
      subject: `Re: ${incomingEmail.subject}`,
      body: '// Draft would be generated by LLM here using the formatted prompt',
      relationship: {
        type: exampleSelection.relationship,
        confidence: detectedRelationship.confidence,
        detectionMethod: detectedRelationship.method
      },
      examplesUsed: exampleSelection.examples.map(e => e.id),
      metadata: {
        promptTemplate: templateName,
        exampleCount: exampleSelection.examples.length,
        diversityScore: exampleSelection.stats.diversityScore,
        timestamp: new Date().toISOString()
      },
      createdAt: new Date()
    };
    
    if (verbose) {
      console.log(chalk.green('\n✅ Draft generated successfully!\n'));
      console.log(chalk.bold('Generated Prompt:'));
      console.log(chalk.gray('─'.repeat(80)));
      console.log(prompt);
      console.log(chalk.gray('─'.repeat(80)));
    }
    
    return draft;
  }
  
  /**
   * Process feedback on a generated draft
   */
  async processDraftFeedback(
    _draftId: string,
    _feedback: {
      edited: boolean;
      editDistance?: number;
      accepted: boolean;
      userRating?: number;
    }
  ): Promise<void> {
    // TODO: Implement feedback processing
    // This would update the usage statistics in the vector store
    console.log(chalk.yellow('📝 Feedback processing not yet implemented'));
  }
  
  /**
   * Load test data (John's emails)
   */
  async loadTestData(userId: string = 'john-test-user'): Promise<void> {
    await this.testDataLoader.initialize();
    await this.testDataLoader.loadAllJohnEmails(userId);
  }
  
  /**
   * Clear all data for a user
   */
  async clearUserData(userId: string): Promise<void> {
    await this.vectorStore.deleteUserData(userId);
  }
  
  /**
   * Get statistics about learned tone
   */
  async getToneStatistics(userId: string): Promise<{
    totalEmails: number;
    relationships: Record<string, number>;
    exampleUsage: Map<string, { used: number; rating: number }>;
  }> {
    const relationshipStats = await this.vectorStore.getRelationshipStats(userId);
    const totalEmails = Object.values(relationshipStats).reduce((a, b) => a + b, 0);
    
    // TODO: Get example usage statistics from usage tracker
    const exampleUsage = new Map();
    
    return {
      totalEmails,
      relationships: relationshipStats,
      exampleUsage
    };
  }
}

// CLI interface for testing
if (require.main === module) {
  const orchestrator = new ToneLearningOrchestrator();
  
  async function runDemo() {
    try {
      await orchestrator.initialize();
      
      console.log(chalk.bold('🎭 Tone Learning Orchestrator Demo\n'));
      
      // Load test data
      const userId = 'john-test-user';
      console.log(chalk.blue('Loading John\'s test emails...'));
      await orchestrator.loadTestData(userId);
      
      // Create a sample incoming email
      const incomingEmail: ProcessedEmail = {
        uid: 'demo-1',
        messageId: '<demo@example.com>',
        inReplyTo: null,
        date: new Date(),
        from: [{ address: 'client@example.com', name: 'Important Client' }],
        to: [{ address: 'john@company.com', name: 'John Mitchell' }],
        cc: [],
        bcc: [],
        subject: 'Performance issues with the platform',
        textContent: 'Hi John, We\'re experiencing slow response times again. Can you look into this urgently?',
        htmlContent: null,
        extractedText: 'Hi John, We\'re experiencing slow response times again. Can you look into this urgently?',
        relationship: {
          type: 'professional',
          confidence: 0.9,
          detectionMethod: 'demo'
        }
      };
      
      // Generate drafts for different recipients
      const recipients = [
        { email: 'sarah@company.com', desc: 'to Sarah (coworker)' },
        { email: 'jim@venturecapital.com', desc: 'to Jim (investor)' },
        { email: 'lisa@example.com', desc: 'to Lisa (wife)' },
        { email: 'mike@example.com', desc: 'to Mike (friend)' }
      ];
      
      for (const recipient of recipients) {
        console.log(chalk.bold(`\n📝 Generating draft ${recipient.desc}:`));
        
        const draft = await orchestrator.generateDraft({
          incomingEmail,
          recipientEmail: recipient.email,
          config: {
            userId,
            maxExamples: 3,
            templateName: 'verbose',
            verbose: true
          }
        });
        
        console.log(chalk.green('\nDraft metadata:'));
        console.log(JSON.stringify(draft.metadata, null, 2));
      }
      
      // Show statistics
      const stats = await orchestrator.getToneStatistics(userId);
      console.log(chalk.bold('\n📊 Tone Learning Statistics:'));
      console.log(chalk.gray(`Total emails: ${stats.totalEmails}`));
      console.log(chalk.gray('Relationships:'));
      Object.entries(stats.relationships).forEach(([rel, count]) => {
        console.log(chalk.gray(`  - ${rel}: ${count}`));
      });
      
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }
  
  runDemo();
}