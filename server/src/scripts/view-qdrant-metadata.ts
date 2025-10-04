/**
 * View metadata stored in Qdrant to verify completeness
 * Shows all fields including bodystructure, flags, size, etc.
 *
 * Usage:
 *   npm run view-qdrant          # View both collections
 *   npm run view-qdrant sent     # View sent-emails only
 *   npm run view-qdrant received # View received-emails only
 */

import { QdrantClient } from '@qdrant/js-client-rest';

const SENT_COLLECTION = 'sent-emails';
const RECEIVED_COLLECTION = 'received-emails';

async function viewQdrantMetadata() {
  const args = process.argv.slice(2);
  const collectionArg = args[0]?.toLowerCase();

  let collectionsToView: string[] = [];
  if (collectionArg === 'sent') {
    collectionsToView = [SENT_COLLECTION];
  } else if (collectionArg === 'received') {
    collectionsToView = [RECEIVED_COLLECTION];
  } else {
    collectionsToView = [SENT_COLLECTION, RECEIVED_COLLECTION];
  }

  console.log('🔍 Viewing Qdrant Email Metadata...\n');

  const client = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333'
  });

  try {
    for (const collectionName of collectionsToView) {
      console.log(`\n${'='.repeat(100)}`);
      console.log(`📧 Collection: ${collectionName.toUpperCase()}`);
      console.log('='.repeat(100));

      let info;
      try {
        info = await client.getCollection(collectionName);
      } catch (error) {
        console.log(`\n⚠️  Collection ${collectionName} does not exist yet.`);
        console.log(`   Run email loading to create this collection.\n`);
        continue;
      }

      console.log(`Total points: ${info.points_count}`);
      console.log(`Vectors count: ${info.vectors_count}`);

      if (info.points_count === 0) {
        console.log(`\n⚠️  No emails stored in ${collectionName} yet.\n`);
        continue;
      }

      // Scroll through all points (limit 10 for display)
      const scrollResult = await client.scroll(collectionName, {
        limit: 10,
        with_payload: true,
        with_vector: false
      });

      const points = scrollResult.points;

      if (points.length === 0) {
        console.log('\n⚠️  No points returned from scroll.\n');
        continue;
      }

      console.log(`\n📧 Showing ${points.length} emails from ${collectionName}:\n`);

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const metadata = point.payload as any;

      console.log(`\n${'='.repeat(100)}`);
      console.log(`Email ${i + 1} (ID: ${point.id})`);
      console.log('='.repeat(100));

      // Basic Info
      console.log('\n📌 Basic Info:');
      console.log(`  Email ID: ${metadata.emailId || 'N/A'}`);
      console.log(`  User ID: ${metadata.userId || 'N/A'}`);
      console.log(`  Email Account ID: ${metadata.emailAccountId || 'N/A'}`);
      console.log(`  Email Type: ${metadata.emailType || 'N/A'}`);
      console.log(`  Subject: ${metadata.subject || 'N/A'}`);
      console.log(`  Sent Date: ${metadata.sentDate || 'N/A'}`);

      // IMAP Metadata (THE KEY FIELDS TO VERIFY)
      console.log('\n🔧 IMAP Metadata:');
      console.log(`  UID: ${metadata.uid !== undefined ? metadata.uid : 'MISSING ❌'}`);
      console.log(`  Folder Name: ${metadata.folderName || 'MISSING ❌'}`);
      console.log(`  Size (bytes): ${metadata.size !== undefined ? metadata.size : 'MISSING ❌'}`);
      console.log(`  Flags: ${metadata.flags ? JSON.stringify(metadata.flags) : 'MISSING ❌'}`);
      console.log(`  Bodystructure: ${metadata.bodystructure ? 'Present ✅' : 'MISSING ❌'}`);

      if (metadata.bodystructure) {
        console.log(`  Bodystructure (truncated): ${JSON.stringify(metadata.bodystructure).substring(0, 200)}...`);
      }

      // Envelope Data
      console.log('\n📨 Envelope Data:');
      console.log(`  From: ${metadata.from || 'N/A'}`);
      console.log(`  To: ${metadata.to ? JSON.stringify(metadata.to) : 'N/A'}`);
      console.log(`  CC: ${metadata.cc ? JSON.stringify(metadata.cc) : 'N/A'}`);
      console.log(`  BCC: ${metadata.bcc ? JSON.stringify(metadata.bcc) : 'N/A'}`);

      // Content
      console.log('\n📝 Content:');
      console.log(`  Recipient Email: ${metadata.recipientEmail || 'N/A'}`);
      console.log(`  Sender Email: ${metadata.senderEmail || 'N/A'}`);
      console.log(`  Sender Name: ${metadata.senderName || 'N/A'}`);
      console.log(`  Word Count: ${metadata.wordCount || 'N/A'}`);
      console.log(`  User Reply Length: ${metadata.userReply ? metadata.userReply.length : 'N/A'} chars`);
      console.log(`  Has Raw Message: ${metadata.eml_file ? 'YES ✅' : 'NO ❌'}`);

      // Relationship
      console.log('\n🤝 Relationship:');
      console.log(`  Type: ${metadata.relationship?.type || 'N/A'}`);
      console.log(`  Confidence: ${metadata.relationship?.confidence || 'N/A'}`);
      console.log(`  Detection Method: ${metadata.relationship?.detectionMethod || 'N/A'}`);

      // Features
      console.log('\n🧬 Features:');
      console.log(`  Features Present: ${metadata.features ? 'YES ✅' : 'NO ❌'}`);
      if (metadata.features) {
        console.log(`  Formality Score: ${metadata.features.stats?.formalityScore || 'N/A'}`);
        console.log(`  Intimacy Markers: ${metadata.features.relationshipHints?.intimacyMarkers?.length || 0}`);
        console.log(`  Professional Markers: ${metadata.features.relationshipHints?.professionalMarkers?.length || 0}`);
      }
    }
    } // End collection loop

    console.log('\n' + '='.repeat(100));
    console.log('\n✅ Metadata inspection complete!');

  } catch (error) {
    console.error('❌ Error viewing metadata:', error);
    process.exit(1);
  }
}

viewQdrantMetadata();
