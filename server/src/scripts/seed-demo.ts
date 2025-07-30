#!/usr/bin/env node
import { Pool } from 'pg';
import crypto from 'crypto';
import { scryptAsync } from '@noble/hashes/scrypt';
import { bytesToHex } from '@noble/hashes/utils';
import dotenv from 'dotenv';
import path from 'path';
import chalk from 'chalk';
import { VectorStore } from '../lib/vector/qdrant-client';
import { EmbeddingService } from '../lib/vector/embedding-service';
import { EmailIngestPipeline } from '../lib/pipeline/email-ingest-pipeline';
import { ProcessedEmail } from '../lib/pipeline/types';
import { RelationshipDetector } from '../lib/relationships/relationship-detector';
import { StyleAggregationService } from '../lib/style/style-aggregation-service';
import { 
  DEMO_USERS, 
  DEFAULT_RELATIONSHIPS, 
  DEMO_PEOPLE, 
  DEMO_EMAILS, 
  DEMO_STYLES 
} from './data/demo-data';

// Load environment variables from the root directory
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// Scrypt configuration matching better-auth
const scryptConfig = {
  N: 16384,
  r: 16,
  p: 1,
  dkLen: 64
};

async function hashPassword(password: string): Promise<string> {
  const saltBuffer = crypto.randomBytes(16);
  const salt = bytesToHex(saltBuffer);
  
  const key = await scryptAsync(
    password.normalize('NFKC'),
    salt,
    {
      N: scryptConfig.N,
      r: scryptConfig.r,
      p: scryptConfig.p,
      dkLen: scryptConfig.dkLen,
      maxmem: 128 * scryptConfig.N * scryptConfig.r * 2
    }
  );
  
  return `${salt}:${bytesToHex(key)}`;
}

async function seedDemo() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  let vectorStore: VectorStore | null = null;
  let embeddingService: EmbeddingService | null = null;
  let ingestionPipeline: EmailIngestPipeline | null = null;
  
  try {
    console.log(chalk.cyan('\n🌱 Starting Demo Data Seed\n'));
    
    // Step 1: Clean existing data
    console.log(chalk.yellow('🧹 Cleaning existing data...'));
    
    // Clean in correct order to avoid foreign key constraints
    await pool.query('DELETE FROM tone_preferences');
    await pool.query('DELETE FROM person_relationships');
    await pool.query('DELETE FROM person_emails');
    await pool.query('DELETE FROM people');
    await pool.query('DELETE FROM user_relationships');
    await pool.query('DELETE FROM "session"');
    await pool.query('DELETE FROM "account"');
    await pool.query('DELETE FROM "user"');
    
    // Clean vector store
    vectorStore = new VectorStore();
    await vectorStore.initialize();
    
    // Delete all user data from vector store
    const allUsersResult = await pool.query('SELECT id FROM "user"');
    for (const user of allUsersResult.rows) {
      await vectorStore.deleteUserData(user.id);
    }
    
    console.log(chalk.green('✓ Existing data cleaned\n'));
    
    // Step 2: Create test users
    console.log(chalk.blue('👤 Creating test users...'));
    
    const userIds: Record<string, string> = {};
    
    for (const testUser of DEMO_USERS) {
      const userId = crypto.randomUUID();
      userIds[testUser.email] = userId;
      
      // Hash password
      const hashedPassword = await hashPassword(testUser.password);
      
      // Create user
      await pool.query(
        `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, testUser.email, testUser.name, true, new Date(), new Date()]
      );
      
      // Create account record
      const accountId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO "account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [accountId, userId, testUser.email, 'credential', hashedPassword, new Date(), new Date()]
      );
      
      console.log(chalk.green(`  ✓ Created user: ${testUser.email} (password: ${testUser.password})`));
    }
    
    // Step 3: Set up relationships for each user
    console.log(chalk.blue('\n🔗 Setting up relationships...'));
    
    for (const userId of Object.values(userIds)) {
      for (const rel of DEFAULT_RELATIONSHIPS) {
        await pool.query(
          `INSERT INTO user_relationships (user_id, relationship_type, display_name, is_system_default, is_active)
           VALUES ($1, $2, $3, true, true)`,
          [userId, rel.type, rel.display]
        );
      }
    }
    console.log(chalk.green('  ✓ Default relationships created'));
    
    // Step 4: Create people (recipients)
    console.log(chalk.blue('\n👥 Creating people...'));
    
    // Only create people for the first user
    const primaryUserId = userIds[DEMO_USERS[0].email];
    
    for (const person of DEMO_PEOPLE) {
      const personId = crypto.randomUUID();
      
      // Create person
      await pool.query(
        `INSERT INTO people (id, user_id, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [personId, primaryUserId, person.name]
      );
      
      // Add emails
      for (const email of person.emails) {
        await pool.query(
          `INSERT INTO person_emails (person_id, email_address, is_primary, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [personId, email, true]
        );
      }
      
      // Add relationships
      for (const rel of person.relationships) {
        // Get the user_relationship_id for this relationship type
        const relResult = await pool.query(
          `SELECT id FROM user_relationships 
           WHERE user_id = $1 AND relationship_type = $2`,
          [primaryUserId, rel.type]
        );
        
        if (relResult.rows.length > 0) {
          const userRelationshipId = relResult.rows[0].id;
          
          await pool.query(
            `INSERT INTO person_relationships (user_id, person_id, user_relationship_id, is_primary, user_set, confidence, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [primaryUserId, personId, userRelationshipId, rel.isPrimary, true, 1.0]
          );
        }
      }
      
      console.log(chalk.green(`  ✓ Created person: ${person.name} (${person.emails.join(', ')})`));
    }
    
    // Step 5: Seed aggregated style data
    console.log(chalk.blue('\n🎨 Seeding style patterns...'));
    
    for (const [relationshipType, style] of Object.entries(DEMO_STYLES)) {
      // Get the user_relationship_id for this relationship type
      const relResult = await pool.query(
        `SELECT id FROM user_relationships 
         WHERE user_id = $1 AND relationship_type = $2`,
        [primaryUserId, relationshipType]
      );
      
      if (relResult.rows.length > 0) {
        const userRelationshipId = relResult.rows[0].id;
        
        const profileData = {
          meta: {
            type: 'category',
            lastAnalyzed: new Date().toISOString(),
            emailCount: style.emailCount,
            confidence: style.confidenceScore
          },
          aggregatedStyle: style
        };
        
        await pool.query(
          `INSERT INTO tone_preferences 
           (user_id, preference_type, target_identifier, user_relationship_id, profile_data, emails_analyzed, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [primaryUserId, 'category', relationshipType, userRelationshipId, JSON.stringify(profileData), style.emailCount]
        );
        
        console.log(chalk.green(`  ✓ Added style for ${relationshipType} (${style.emailCount} emails, ${Math.round(style.confidenceScore * 100)}% confidence)`));
      }
    }
    
    // Step 6: Ingest emails via pipeline
    console.log(chalk.blue('\n📧 Ingesting sample emails...'));
    
    // Initialize services
    embeddingService = new EmbeddingService();
    await embeddingService.initialize();
    
    ingestionPipeline = new EmailIngestPipeline(
      vectorStore,
      embeddingService,
      new RelationshipDetector(),
      new StyleAggregationService(vectorStore),
      { batchSize: 10, parallelism: 5, errorThreshold: 0.1 }
    );
    
    // Convert emails to ProcessedEmail format
    const processedEmails: ProcessedEmail[] = [];
    let emailId = 1;
    
    for (const email of DEMO_EMAILS) {
      const processedEmail: ProcessedEmail = {
        uid: `demo-${emailId}`,
        messageId: `<demo-${emailId}-${Date.now()}@example.com>`,
        inReplyTo: null,
        date: new Date(),
        from: [{ address: 'user@example.com', name: 'User' }],
        to: [{ 
          address: email.recipientEmail, 
          name: email.recipientName 
        }],
        cc: [],
        bcc: [],
        subject: email.subject,
        textContent: email.body,
        htmlContent: null,
        extractedText: email.body,
        relationship: {
          type: email.relationshipType,
          confidence: 1.0,
          detectionMethod: 'demo-seed'
        }
      };
      
      processedEmails.push(processedEmail);
      emailId++;
    }
    
    // Process emails through the pipeline
    const startTime = Date.now();
    const results = await ingestionPipeline.processHistoricalEmails(
      primaryUserId, 
      'demo-seed', 
      processedEmails
    );
    const duration = Date.now() - startTime;
    
    console.log(chalk.green(`  ✓ Processed ${results.processed} emails in ${duration}ms`));
    console.log(chalk.gray(`    Errors: ${results.errors}`));
    console.log(chalk.gray(`    Distribution: ${JSON.stringify(results.relationshipDistribution)}`));
    
    // Step 7: Verify the seed
    console.log(chalk.blue('\n✅ Verifying seed...'));
    
    const stats = await vectorStore.getRelationshipStats(primaryUserId);
    console.log(chalk.gray('  Emails in vector store:'));
    for (const [rel, count] of Object.entries(stats)) {
      console.log(chalk.gray(`    ${rel}: ${count} emails`));
    }
    
    const collectionInfo = await vectorStore.getCollectionInfo();
    console.log(chalk.gray(`  Total vectors: ${collectionInfo.vectorCount}`));
    
    // Summary
    console.log(chalk.green('\n✨ Demo data seed completed successfully!'));
    console.log(chalk.cyan('\n📋 Summary:'));
    console.log(`  - ${DEMO_USERS.length} test users created`);
    console.log(`  - ${DEFAULT_RELATIONSHIPS.length} relationship types per user`);
    console.log(`  - ${DEMO_PEOPLE.length} people (recipients) created`);
    console.log(`  - ${Object.keys(DEMO_STYLES).length} style patterns seeded`);
    console.log(`  - ${processedEmails.length} emails ingested`);
    
    console.log(chalk.cyan('\n🔑 Test Users:'));
    for (const user of DEMO_USERS) {
      console.log(`  📧 ${user.email} / 🔑 ${user.password}`);
    }
    
    console.log(chalk.cyan('\n🚀 Ready to test!'));
    console.log('  1. Start the app: npm run dev:all');
    console.log('  2. Sign in with a test user');
    console.log('  3. Go to the inspector: http://localhost:3001/inspector');
    console.log('  4. Try analyzing emails to see similar examples and style patterns');
    
  } catch (error) {
    console.error(chalk.red('\n❌ Seed failed:'), error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the seed if called directly
if (require.main === module) {
  seedDemo();
}

export { seedDemo };