# Testing Guide for AI Email Assistant

## Overview

The project uses Jest for testing with two main categories:
- **Unit Tests**: Tests with mocked dependencies that don't require external services
- **Integration Tests**: Tests that connect to real services (PostgreSQL, Redis, Qdrant)

## Quick Start

### Running Tests

```bash
# Run ALL tests (unit + integration)
npm test

# Run ONLY unit tests (no external services needed)
npm run test:unit

# Run ONLY integration tests (requires Docker services)
docker compose up -d  # Start PostgreSQL, Redis, Qdrant
npm run test:integration

# Test specific services
npm run test:qdrant      # Test Qdrant connection
npm run test:templates   # Test Handlebars templates
```

## Docker Services Required

For integration tests, start the required services:

```bash
# Start all services
docker compose up -d

# Individual service management
npm run qdrant:up     # Just Qdrant
npm run qdrant:logs   # View Qdrant logs
npm run qdrant:reset  # Reset Qdrant data
```

Services and their ports:
- PostgreSQL: 5434
- Redis: 6380
- Qdrant: 6333/6334

## Test Organization and File Structure

### Unit Tests (Mocked Dependencies)
Files ending in `.unit.test.ts` or specific unit test files:
- `vector-store.unit.test.ts` - Vector store with mocked Qdrant
- `template-manager.test.ts` - Handlebars template tests
- `crypto.test.ts` - Cryptography utilities
- Pipeline tests with mocks

### Integration Tests (Real Services)
Files ending in `.integration.test.ts` or specific integration files:
- `vector-store-integration.test.ts` - Real Qdrant instance
- `embedding-service.test.ts` - Real ML model (no external services needed)

## How to Write New Tests

### Unit Test Example
```typescript
// filename.unit.test.ts
import { jest } from '@jest/globals';

describe('MyComponent', () => {
  beforeEach(() => {
    // Mock external dependencies
    jest.mock('qdrant-js');
  });

  it('should handle basic functionality', () => {
    // Test with mocked dependencies
  });
});
```

### Integration Test Example
```typescript
// filename.integration.test.ts
describe('MyComponent Integration', () => {
  beforeAll(async () => {
    // Ensure services are running
    // Initialize real connections
  });

  afterAll(async () => {
    // Clean up connections
  });

  it('should work with real services', async () => {
    // Test with actual services
  });
});
```

## Test Categories and Their Purposes

### Vector Store Tests
- **Unit**: `vector-store.unit.test.ts` - Tests business logic with mocked Qdrant
- **Integration**: `vector-store-integration.test.ts` - Tests actual Qdrant operations
- **Purpose**: Ensure vector storage and retrieval works correctly

### Embedding Service Tests
- **File**: `embedding-service.test.ts`
- **Purpose**: Test ML model integration for generating embeddings
- **Note**: Uses local model, no external services required

### Template Manager Tests
- **File**: `template-manager.test.ts`
- **Purpose**: Test Handlebars template compilation and rendering
- **Type**: Unit test (no external dependencies)

### Cryptography Tests
- **File**: `crypto.test.ts`
- **Purpose**: Test encryption/decryption utilities
- **Type**: Unit test

### LLM Client Tests
- **File**: `llm-client.test.ts`
- **Purpose**: Test LLM provider detection, model info, and configuration
- **Type**: Unit test (uses Vercel AI SDK)

### LLM Providers API Tests
- **File**: `routes/llm-providers.test.ts`
- **Purpose**: Test LLM provider CRUD operations and validation
- **Type**: Integration test (requires database)

## Common Issues and Troubleshooting

### Issue: "Cannot read properties of undefined (reading 'QdrantClient')"
**Cause**: Running unit test that has mocked dependencies  
**Solution**: Use the integration test instead:
```bash
# Wrong
npm test -- vector-store.unit.test.ts

# Right
npm test -- vector-store-integration.test.ts
```

### Issue: "Module not found: Error: Can't resolve 'server/server/...'"
**Cause**: Running script from wrong directory  
**Solution**: Run from project root:
```bash
# Wrong
cd server && npx tsx src/lib/pipeline/test-qdrant-connection.ts

# Right (from project root)
npm run test:qdrant
```

### Issue: "Failed to initialize Qdrant"
**Cause**: Qdrant not running or wrong test file  
**Solution**: 
1. Start Qdrant: `npm run qdrant:up`
2. Verify you're running integration test, not unit test
3. Test connection: `npm run test:qdrant`

## Testing Workflow

1. **During Development** - Run unit tests frequently:
   ```bash
   npm run test:unit
   ```

2. **Before Commits** - Run all tests:
   ```bash
   docker compose up -d
   npm test
   ```

3. **Debugging Integration Issues**:
   ```bash
   npm run qdrant:up
   npm run test:qdrant
   npm run qdrant:logs
   ```

## Running Specific Test Suites

### Only unit tests (no external dependencies):
```bash
npm test -- --testPathPattern="template-manager|crypto|unit" --testPathIgnorePatterns="integration"
```

### Only integration tests (requires services):
```bash
# Start required services first
docker compose up -d

# Run integration tests
npm test -- --testPathPattern="integration|vector-store-integration|embedding-service"
```

### Test a specific file:
```bash
npm test -- server/src/lib/__tests__/template-manager.test.ts
```

## Test Scripts Reference

| Script | Purpose | Requirements |
|--------|---------|--------------|
| `npm test` | Run all tests | Docker services |
| `npm run test:unit` | Unit tests only | None |
| `npm run test:integration` | Integration tests | Docker services |
| `npm run test:qdrant` | Test Qdrant connection | Qdrant running |
| `npm run test:templates` | Test Handlebars | None |
| `npm run test:pipeline:mock` | Pipeline with mocks | None |

## Best Practices

1. **Name test files clearly**: Use `.unit.test.ts` or `.integration.test.ts` suffixes
2. **Mock external dependencies** in unit tests to ensure fast, reliable tests
3. **Use beforeAll/afterAll** in integration tests to manage connections
4. **Clean up test data** after integration tests to ensure test isolation
5. **Run unit tests frequently** during development for fast feedback
6. **Run full test suite** before committing changes