module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.integration.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'server/src/**/*.{ts,tsx}',
    '!server/src/**/*.d.ts',
    '!server/src/**/*.test.ts',
    '!server/src/**/*.integration.test.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/src/$1'
  }
};