import { configureTestDatabaseEnvironment } from './test-database-url';

// Vitest setupFiles entry: runs before any test module imports the runtime
// client, so every test process resolves DATABASE_URL through the test policy.
configureTestDatabaseEnvironment(process.env);
