# Scripts Directory

This directory contains demo scripts, test utilities, and tools for the AI Email Assistant project.

## Directory Structure

```
scripts/
├── demos/          # Interactive demonstrations
├── tests/          # Test scripts for specific features
└── tools/          # Utility scripts for data management
```

## Demo Scripts

### NLP Feature Demos

#### `demos/demo-nlp.js`
Comprehensive demonstration of all NLP features including:
- Sentiment analysis with emotions
- Relationship familiarity detection
- Tone analysis (warmth, formality, politeness, etc.)
- Linguistic style analysis

```bash
npm run demo:nlp
```

#### `demos/demo-nlp-interactive.js`
Interactive CLI tool for real-time text analysis. Enter any text to see:
- Sentiment and emotion detection
- Relationship hints
- Tone qualities
- Statistics

```bash
npm run demo:nlp:interactive
```

### Pipeline Demos

#### `demos/demo-highland-pipeline.ts`
Demonstrates the Highland.js email processing pipeline:
- Batch processing with progress tracking
- Error handling and recovery
- Performance metrics
- Backpressure management

```bash
npm run demo:pipeline
```

#### `demos/demo-websocket-processing.ts`
Shows real-time WebSocket integration:
- Live email processing logs
- IMAP operation tracking
- Error monitoring
- Performance metrics

```bash
npm run demo:websocket
```

## Test Scripts

### `tests/vector-comprehensive-test.ts`
Comprehensive test suite for vector storage and embedding services:
- Connection and health checks
- Embedding generation (single and batch)
- Vector similarity search
- Relationship-based filtering
- Near-duplicate detection
- Usage tracking
- Performance testing

```bash
npm run vector:test
```

## Pipeline Scripts (in `src/lib/pipeline/`)

### Core Components

#### `tone-learning-orchestrator.ts`
Main orchestration service that coordinates:
- Email ingestion
- Feature extraction
- Example selection
- Draft generation

```bash
npm run tone:demo
```

#### `test-data-loader.ts`
Manages test data in the vector store:
- Load John's test emails
- Clear test data
- Reset database

```bash
npm run tone:load    # Load test data
npm run tone:clear   # Clear test data
npm run tone:reset   # Reset and reload
```

#### `test-e2e-flow.ts`
End-to-end test of the complete tone learning system:
- Loads test emails
- Processes relationships
- Generates drafts
- Validates output

```bash
npm run tone:e2e
```

### Test Scripts

- `test-pipeline.ts` - Full pipeline integration test
- `test-pipeline-mock.ts` - Pipeline test with mocked dependencies
- `test-prompt-formatter.ts` - Tests prompt generation
- `test-templates.ts` - Tests Handlebars templates

## Prerequisites

### For Demo Scripts
- Docker services running: `docker compose up -d`
- Test users created: `npm run db:seed`

### For Vector/Embedding Tests
- Qdrant running: `npm run qdrant:up`
- Embedding model will download on first run (~30MB)

### For Pipeline Tests
- All Docker services running
- Test email data loaded: `npm run tone:load`

## Common Issues

### "Cannot connect to Qdrant"
```bash
# Reset Qdrant
npm run qdrant:reset
```

### "No test data found"
```bash
# Load John's test emails
npm run tone:load
```

### "Port already in use"
```bash
# Reset all Docker services
npm run docker:reset
```

## Adding New Scripts

1. Place demos in `demos/` directory
2. Place tests in `tests/` directory
3. Place utilities in `tools/` directory
4. Update this README with documentation
5. Add npm script to package.json if needed