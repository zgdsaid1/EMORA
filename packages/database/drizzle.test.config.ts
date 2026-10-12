import 'dotenv/config';

import { defineConfig } from 'drizzle-kit';

import { validateTestDatabaseUrl } from './src/test-database-url';

const testDatabaseUrl = validateTestDatabaseUrl(
  process.env.TEST_DATABASE_URL,
);

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: testDatabaseUrl,
  },
  strict: true,
  verbose: true,
});