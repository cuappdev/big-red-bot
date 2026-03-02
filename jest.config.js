export default {
  // Use ts-jest preset for TypeScript support
  preset: "ts-jest",
  testEnvironment: "node",

  // Test discovery
  roots: ["<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],

  // TypeScript transformation
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "js", "json"],

  // Module resolution
  transformIgnorePatterns: [
    "node_modules/(?!(google-spreadsheet|ky|@sindresorhus)/)",
  ],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  // Test setup and environment
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testEnvironmentOptions: {
    NODE_ENV: "test",
  },

  // Coverage configuration
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts",
  ],
  coverageDirectory: "coverage",

  // Output
  verbose: true,
};
