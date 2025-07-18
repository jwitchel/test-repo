# Testing Guide for AI Email Assistant

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

## Test Organization

### Unit Tests (Mocked Dependencies)
Files ending in `.unit.test.ts` or specific unit test files:
- `vector-store.unit.test.ts` - Vector store with mocked Qdrant
- `template-manager.test.ts` - Handlebars template tests
- `crypto.test.ts` - Cryptography utilities
- Pipeline tests with mocks

### Integration Tests (Real Services)
Files ending in `.integration.test.ts` or specific integration files:
- `vector-store-integration.test.ts` - Real Qdrant instance
- `embedding-service.test.ts` - Real ML model

## Common Issues and Solutions

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
**Cause**: Qdrant not running
**Solution**: Start Qdrant first:
```bash
npm run qdrant:up
# or
docker compose up -d qdrant
```

## Testing Workflow

1. **For development** - Run unit tests frequently:
   ```bash
   npm run test:unit
   ```

2. **Before commits** - Run all tests:
   ```bash
   docker compose up -d
   npm test
   ```

3. **Debugging Qdrant issues**:
   ```bash
   npm run qdrant:up
   npm run test:qdrant
   npm run qdrant:logs
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

## Docker Services

Start all required services:
```bash
docker compose up -d
```

Individual services:
```bash
npm run qdrant:up     # Just Qdrant
npm run qdrant:logs   # View Qdrant logs
npm run qdrant:reset  # Reset Qdrant data
```