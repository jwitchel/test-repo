# Test Documentation

## Test Categories

### Unit Tests
These tests don't require external services:
- `template-manager.test.ts` - Tests for Handlebars template system
- `vector-store.unit.test.ts` - Unit tests for vector store with mocks
- Pipeline tests with mocks - Use `npm run test:pipeline:mock`

Run all unit tests: `npm run test:unit`

### Integration Tests
These tests require external services to be running:

#### Vector Store Tests
**Requires**: Qdrant running on port 6333

```bash
# Start Qdrant first
npm run qdrant:up

# Test Qdrant connection
npm run test:qdrant

# Run integration tests
npm test -- server/src/lib/__tests__/vector-store-integration.test.ts
```

#### Embedding Service Tests
**Requires**: No external services (uses local ML model)

```bash
npm test -- server/src/lib/__tests__/embedding-service.test.ts
```

## Running Specific Test Suites

### Only unit tests (no external dependencies):
```bash
npm test -- --testPathPattern="template-manager|crypto" --testPathIgnorePatterns="vector|embedding"
```

### Only integration tests (requires services):
```bash
# Start required services
npm run qdrant:up
docker compose up -d

# Run integration tests
npm test -- --testPathPattern="vector|integration"
```

## Common Issues

### "Failed to initialize Qdrant" Error
This can happen for two reasons:

1. **Qdrant is not running** - Start it with:
   ```bash
   npm run qdrant:up
   ```

2. **Running wrong test file** - Make sure you're running the integration test, not the unit test:
   - ❌ `vector-store.unit.test.ts` - Uses mocks, won't connect to real Qdrant
   - ✅ `vector-store-integration.test.ts` - Connects to real Qdrant instance

### Testing Qdrant Connection
To verify Qdrant is working:
```bash
# Run from project root (not server directory)
npx tsx server/src/lib/pipeline/test-qdrant-connection.ts
```

### Unit Tests vs Integration Tests

**Unit Tests** (with mocks):
- `vector-store.unit.test.ts` - Tests vector store logic with mocked Qdrant client
- Pipeline tests with mocks - Use `npm run test:pipeline:mock`
- Template tests - Use `npm run test:templates`

**Integration Tests** (require services):
- `vector-store-integration.test.ts` - Tests against real Qdrant instance
- `embedding-service.test.ts` - Tests with real ML model

Run specific test types:
```bash
npm run test:unit        # Only unit tests
npm run test:integration # Only integration tests (start services first!)
```