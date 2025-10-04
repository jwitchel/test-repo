/**
 * Script to clear all data from Qdrant vector database
 * Used for testing to start with clean state
 */

import { QdrantClient } from '@qdrant/js-client-rest';

async function clearQdrant() {
  console.log('🧹 Clearing Qdrant vector database...');

  const client = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333'
  });

  const collectionName = 'user_emails';

  try {
    console.log(`Checking if collection ${collectionName} exists...`);

    const collections = await client.getCollections();
    const exists = collections.collections?.some(c => c.name === collectionName);

    if (exists) {
      console.log(`✅ Collection ${collectionName} exists, deleting...`);
      await client.deleteCollection(collectionName);
      console.log('✅ Collection deleted');
    } else {
      console.log(`ℹ️  Collection ${collectionName} does not exist`);
    }

    // Recreate the collection
    console.log('Creating fresh collection...');
    await client.createCollection(collectionName, {
      vectors: {
        size: 384,
        distance: 'Cosine'
      },
      optimizers_config: {
        indexing_threshold: 0  // Index immediately for testing
      }
    });
    console.log('✅ Created empty collection');

    // Verify it's empty
    const info = await client.getCollection(collectionName);
    console.log(`✅ Collection info: ${info.points_count} points`);

    console.log('🎉 Qdrant cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing Qdrant:', error);
    process.exit(1);
  }
}

clearQdrant();
