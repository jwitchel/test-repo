// Mock for better-auth to avoid ESM issues in tests
module.exports = {
  betterAuth: jest.fn(() => ({
    api: {
      auth: jest.fn()
    },
    handler: jest.fn()
  }))
};