export const preset = "ts-jest";
export const testEnvironment = "node";
export const roots = ["<rootDir>/tests"];
export const testMatch = ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"];
export const transform = {
  "^.+\\.ts$": "ts-jest",
};
export const collectCoverageFrom = [
  "src/**/*.ts",
  "!src/**/*.test.ts",
  "!src/**/*.spec.ts",
];
export const moduleFileExtensions = ["ts", "js", "json"];
export const coverageDirectory = "coverage";
export const verbose = true;
export const transformIgnorePatterns = [
  "node_modules/(?!(google-spreadsheet|ky|@sindresorhus)/)",
];
export const moduleNameMapper = {
  "^(\\.{1,2}/.*)\\.js$": "$1",
};
export const setupFilesAfterEnv = ["<rootDir>/tests/setup.ts"];
export const testEnvironmentOptions = {
  NODE_ENV: "test",
};
