module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  clearMocks: true,
  coverageThreshold: {
    global: {
      statements: 58,
      branches: 48,
      functions: 45,
      lines: 62,
    },
    './middleware/auth.js': {
      statements: 75,
      branches: 70,
      functions: 75,
      lines: 75,
    },
    './utils/databaseSecurity.js': {
      statements: 90,
      branches: 85,
      functions: 95,
      lines: 92,
    },
    './models/Payment.js': {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95,
    },
  },
};
