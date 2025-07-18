const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Unit Tests',
  testMatch: [
    '**/*.unit.test.ts',
    '**/server/src/lib/pipeline/__tests__/**/*.test.ts',
    '**/server/src/__tests__/crypto.test.ts',
    '**/server/src/__tests__/text-extraction.test.ts',
    '**/server/src/__tests__/imap-logger.test.ts',
    '**/server/src/__tests__/routes/email-accounts-get-delete.test.ts'
  ],
  testPathIgnorePatterns: [
    ...baseConfig.testPathIgnorePatterns,
    'integration',
    'vector-store-integration',
    'embedding-service.test',  // This is actually an integration test
    'vector-store.unit.test',  // Mock-based test - use integration test instead
    'vector-integration.unit.test'  // Mock-based test - use integration test instead
  ]
};