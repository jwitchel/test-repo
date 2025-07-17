# Vector Services

This directory contains the vector storage and embedding services for the AI Email Assistant's tone learning system.

## Components

### 1. Embedding Service (`embedding-service.ts`)
- Uses Xenova/all-MiniLM-L6-v2 model for 384-dimensional embeddings
- Supports single text and batch embedding generation
- Includes text similarity comparison using cosine similarity
- Handles text truncation for model token limits

### 2. Qdrant Client (`qdrant-client.ts`)
- Manages vector storage in Qdrant database
- **Relationship-aware search**: Primary filtering by relationship type
- Supports near-duplicate detection
- Tracks usage statistics and effectiveness scores
- Handles numeric ID conversion for Qdrant compatibility

### 3. Usage Tracker (`usage-tracker.ts`)
- Tracks which examples were used in draft generation
- Processes user feedback (edits, acceptance, ratings)
- Calculates effectiveness scores based on user behavior
- Supports pruning ineffective examples

## Setup

1. Ensure Qdrant is running:
   ```bash
   npm run qdrant:up
   ```

2. Test the services:
   ```bash
   npm run test:vector
   ```

## Key Features

### Relationship-Based Vector Search
The system prioritizes relationship context when searching for similar emails:
- Searches first within the same relationship type
- Falls back to adjacent relationships if needed
- Maintains relationship-specific tone profiles

### Continuous Learning
- Tracks example usage in draft generation
- Updates effectiveness scores based on user edits
- Improves selection algorithm over time

### Performance Optimizations
- Batch processing for embeddings
- Configurable search limits and thresholds
- Automatic indexing in Qdrant

## Environment Variables

See `.env.example` for all vector-related configuration options:
- `QDRANT_URL`: Qdrant server URL
- `VECTOR_SEARCH_LIMIT`: Maximum search results
- `VECTOR_SCORE_THRESHOLD`: Minimum similarity score
- `NEAR_DUPLICATE_THRESHOLD`: Threshold for duplicate detection
- `EMBEDDING_BATCH_SIZE`: Batch size for embedding generation

## Usage Example

```typescript
import { embeddingService, vectorStore } from './vector';

// Generate embedding
const result = await embeddingService.embedText('Hello world');

// Store in Qdrant with relationship context
await vectorStore.upsertEmail({
  id: 'email-123',
  userId: 'user-456',
  vector: result.vector,
  metadata: {
    // ... email metadata including relationship info
  }
});

// Search with relationship filtering
const similar = await vectorStore.searchSimilar({
  userId: 'user-456',
  queryVector: queryEmbedding,
  relationship: 'colleagues',
  limit: 25
});
```