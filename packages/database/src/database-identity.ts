import postgres from 'postgres';

import {
  TEST_DATABASE_NAME,
  validateTestDatabaseUrl,
} from './test-database-url.js';

export { TEST_DATABASE_NAME };

/** Query the server's identity using only a validated local test URL. */
export async function currentTestDatabaseName(
  value: string | undefined = process.env.TEST_DATABASE_URL,
): Promise<string> {
  const client = postgres(validateTestDatabaseUrl(value), { max: 1 });
  try {
    const rows = await client.unsafe(
      'select current_database() as database_name',
    );
    const databaseName = rows[0]?.database_name;
    if (typeof databaseName !== 'string') {
      throw new Error(
        'The PostgreSQL server did not return its database name.',
      );
    }
    return databaseName;
  } finally {
    await client.end({ timeout: 5 });
  }
}
