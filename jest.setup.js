// Set test environment variables
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://aiemailuser:aiemailpass@localhost:5434/aiemaildb';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
process.env.SKIP_SERVER_START = 'true';

// Suppress console logs during tests unless explicitly testing them
if (process.env.SILENT_TESTS !== 'false') {
  // Store original console methods
  const originalConsole = { ...console };

  global.console = {
    ...originalConsole,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}