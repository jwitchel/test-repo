const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Integration Tests',
  testMatch: [
    '**/server/src/lib/__tests__/vector-store-integration.test.ts',
    '**/server/src/lib/__tests__/embedding-service.test.ts',
    '**/__tests__/**/*integration*.test.ts'
  ],
  testPathIgnorePatterns: [
    ...baseConfig.testPathIgnorePatterns,
    'vector-store.unit.test.ts',  // This one uses mocks
    'vector-integration.unit.test.ts'  // This one also uses mocks
  ]
};