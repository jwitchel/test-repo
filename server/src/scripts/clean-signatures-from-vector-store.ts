import { VectorStore } from '../lib/vector/qdrant-client';
import { RegexSignatureDetector } from '../lib/regex-signature-detector';
import { pool } from '../server';
import { EmbeddingService } from '../lib/vector/embedding-service';

const regexSignatureDetector = new RegexSignatureDetector(pool);

async function cleanSignaturesFromVectorStore(userId?: string) {
  const vectorStore = new VectorStore();
  await vectorStore.initialize();
  
  const embeddingService = new EmbeddingService();
  await embeddingService.initialize();
  
  try {
    // Get all users or specific user
    let users: { id: string; email: string }[] = [];
    
    if (userId) {
      users = [{ id: userId, email: 'specified-user' }];
    } else {
      const result = await pool.query('SELECT id, email FROM "user"');
      users = result.rows;
    }
    
    for (const user of users) {
      console.log(`\n=== Processing user: ${user.email} (${user.id}) ===`);
      
      // Load user's signature patterns
      const patterns = await regexSignatureDetector.loadUserPatterns(user.id);
      console.log(`Loaded ${patterns.length} signature patterns`);
      
      if (patterns.length === 0) {
        console.log('No patterns configured, skipping...');
        continue;
      }
      
      // Get all relationships for the user
      const relationshipStats = await vectorStore.getRelationshipStats(user.id);
      const relationships = Object.keys(relationshipStats);
      
      let totalProcessed = 0;
      let totalCleaned = 0;
      
      for (const relationship of relationships) {
        console.log(`\nProcessing relationship: ${relationship}`);
        
        // Get all emails for this relationship
        const emails = await vectorStore.getByRelationship(user.id, relationship, 1000);
        console.log(`Found ${emails.length} emails`);
        
        for (const email of emails) {
          // Use rawText if available, otherwise use userReply
          const originalText = email.metadata.rawText || email.metadata.userReply || '';
          
          // Remove signature
          const result = await regexSignatureDetector.removeSignature(originalText, user.id);
          
          if (result.signature) {
            // Skip if cleaned text is empty
            if (!result.cleanedText.trim()) {
              console.log(`  Skipping email ${email.id}: empty after signature removal`);
              continue;
            }
            
            // Update the email in vector store
            const updatedMetadata = {
              ...email.metadata,
              extractedText: result.cleanedText,
              rawText: originalText // Preserve original text
            };
            
            // Re-embed with cleaned text
            const { vector } = await embeddingService.embedText(result.cleanedText);
            
            // Update in vector store
            await vectorStore.upsertEmail({
              id: email.id,
              userId: user.id,
              vector,
              metadata: updatedMetadata
            });
            
            totalCleaned++;
            
            if (totalCleaned === 1 || totalCleaned % 10 === 0) {
              console.log(`  Cleaned email ${totalCleaned}: removed ${result.signature.split('\n').length} lines`);
            }
          }
          
          totalProcessed++;
        }
      }
      
      console.log(`\nSummary for ${user.email}:`);
      console.log(`- Total emails processed: ${totalProcessed}`);
      console.log(`- Emails with signatures removed: ${totalCleaned}`);
      console.log(`- Percentage cleaned: ${totalProcessed > 0 ? (totalCleaned / totalProcessed * 100).toFixed(1) : 0}%`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

// Check command line arguments
const userId = process.argv[2];

if (process.argv.includes('--help')) {
  console.log('Usage: npx tsx clean-signatures-from-vector-store.ts [userId]');
  console.log('  userId: Optional. If not provided, processes all users.');
  process.exit(0);
}

// Run the cleaning
console.log('=== Cleaning Signatures from Vector Store ===');
console.log(userId ? `Processing single user: ${userId}` : 'Processing all users');

cleanSignaturesFromVectorStore(userId).catch(console.error);