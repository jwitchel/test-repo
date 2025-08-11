import { VectorStore } from '../lib/vector/qdrant-client';
import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function deleteAllRecords() {
  console.log('🗑️  Starting to delete ALL records from Qdrant database...\n');
  
  try {
    const vectorStore = new VectorStore();
    await vectorStore.initialize();
    
    // Get the actual client and collection name
    const client = vectorStore['client'] as QdrantClient;
    const collectionName = vectorStore['collectionName'];
    
    // First, let's check if we have any records by doing a scroll
    console.log('📊 Checking current records...');
    const scrollResult = await client.scroll(collectionName, {
      limit: 1,
      with_payload: false,
      with_vector: false
    });
    
    console.log(`Found ${scrollResult.points.length} record(s) in initial check`);
    
    // Count all records
    let totalCount = 0;
    let nextPageOffset = scrollResult.next_page_offset;
    
    while (nextPageOffset) {
      const nextPage = await client.scroll(collectionName, {
        offset: nextPageOffset,
        limit: 1000,
        with_payload: false,
        with_vector: false
      });
      totalCount += nextPage.points.length;
      nextPageOffset = nextPage.next_page_offset;
    }
    
    totalCount += scrollResult.points.length;
    console.log(`\n📊 Total records found: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log('✅ Collection is already empty!');
      return;
    }
    
    // Delete ALL records - use a condition that matches everything
    console.log('\n🔥 Deleting all records...');
    
    // Option 1: Delete by scrolling through all records
    let deleted = 0;
    let offset = undefined;
    
    while (true) {
      const batch = await client.scroll(collectionName, {
        offset,
        limit: 1000,
        with_payload: false,
        with_vector: false
      });
      
      if (batch.points.length === 0) break;
      
      const ids = batch.points.map(p => p.id);
      await client.delete(collectionName, {
        points: ids,
        wait: true
      });
      
      deleted += ids.length;
      console.log(`Deleted ${deleted}/${totalCount} records...`);
      
      offset = batch.next_page_offset;
      if (!offset) break;
    }
    
    // Verify deletion
    console.log('\n🔍 Verifying deletion...');
    const verifyResult = await client.scroll(collectionName, {
      limit: 1,
      with_payload: false,
      with_vector: false
    });
    
    console.log(`\n✅ Deletion complete!`);
    console.log(`📊 Records remaining: ${verifyResult.points.length}`);
    
    if (verifyResult.points.length > 0) {
      console.warn('\n⚠️  Warning: Some records may still remain. You may need to delete the collection and recreate it.');
    }
    
  } catch (error) {
    console.error('❌ Error deleting records:', error);
    process.exit(1);
  }
}

// Add confirmation prompt
console.log('⚠️  WARNING: This will delete ALL records from the Qdrant database!');
console.log('This action cannot be undone.\n');

// Run the deletion
deleteAllRecords().then(() => {
  console.log('\n✨ Done!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});