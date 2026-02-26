/**
 * Global test setup
 * 
 * This file runs once before all tests and sets up an in-memory MongoDB instance
 * using mongodb-memory-server. This ensures:
 * - Tests don't require a running MongoDB server
 * - Each test run starts with a clean database
 * - Tests are isolated and don't affect production/development data
 */

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer: MongoMemoryServer;

// Set NODE_ENV to test
process.env.NODE_ENV = "test";

beforeAll(async () => {
  // Create an in-memory MongoDB instance for testing
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Set the test database URI
  process.env.TEST_DATABASE_URI = mongoUri;
  
  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  // Disconnect and stop the in-memory database
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clear all collections after each test to ensure test isolation
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
