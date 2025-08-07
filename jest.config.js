module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  roots: ['<rootDir>/server/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/', 
    '/.next/',
    // Exclude tests that require better-auth/jose ESM modules
    'person-service.test.ts',
    'writing-pattern-analyzer.test.ts',
    'llm-providers.test.ts',
    'generate.test.ts',
    'style-preferences.test.ts',
    'text-extraction.test.ts'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'server/src/**/*.{ts,tsx}',
    '!server/src/**/*.d.ts',
    '!server/src/**/*.test.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/src/$1'
  }
};