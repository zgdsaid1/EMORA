/** The authoritative EMORA Production Supabase project. Test URLs must reject it. */
export const PRODUCTION_SUPABASE_PROJECT_REF = 'uxewqvkzcjznmapveuiv';

export const TEST_DATABASE_NAME = 'emora_test';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const TEST_DATABASE_PORTS = new Set(['5432', '5433']);
const DISABLED_TEST_DATABASE_URL =
  'postgresql://disabled:disabled@127.0.0.1:1/emora_test';

export class UnsafeTestDatabaseUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeTestDatabaseUrlError';
  }
}

/**
 * Accept only the explicitly isolated local test database. Remote hosts are
 * rejected even when their Supabase project reference is not recognizable.
 */
export function validateTestDatabaseUrl(value: string | undefined): string {
  if (!value) {
    throw new UnsafeTestDatabaseUrlError(
      'TEST_DATABASE_URL is required when database integration tests are requested.',
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UnsafeTestDatabaseUrlError(
      'TEST_DATABASE_URL is not a valid URL.',
    );
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new UnsafeTestDatabaseUrlError(
      'TEST_DATABASE_URL must use the PostgreSQL protocol.',
    );
  }

  let username: string;
  let password: string;
  try {
    // Decode both userinfo fields inside the same failure boundary so malformed
    // percent-encoding is normalized to the public safety error below.
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    throw new UnsafeTestDatabaseUrlError(
      'TEST_DATABASE_URL contains malformed credentials.',
    );
  }

  if (!username || !password) {
    throw new UnsafeTestDatabaseUrlError(
      'TEST_DATABASE_URL requires explicit test credentials.',
    );
  }

  if (url.hash || url.search) {
    throw new UnsafeTestDatabaseUrlError(
      'TEST_DATABASE_URL must not contain a fragment or query parameters.',
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!LOOPBACK_HOSTS.has(hostname)) {
    throw new UnsafeTestDatabaseUrlError(
      'TEST_DATABASE_URL must use a loopback host; remote database identity is not accepted for tests.',
    );
  }

  if (!TEST_DATABASE_PORTS.has(url.port)) {
    throw new UnsafeTestDatabaseUrlError(
      'TEST_DATABASE_URL must use an explicitly supported local test port.',
    );
  }

  const identity = `${hostname} ${username} ${url.pathname}`.toLowerCase();
  if (identity.includes(PRODUCTION_SUPABASE_PROJECT_REF)) {
    throw new UnsafeTestDatabaseUrlError(
      'TEST_DATABASE_URL identifies the authoritative EMORA Production Supabase project.',
    );
  }

  if (url.pathname.replace(/^\//, '') !== TEST_DATABASE_NAME) {
    throw new UnsafeTestDatabaseUrlError(
      `TEST_DATABASE_URL must target the dedicated ${TEST_DATABASE_NAME} database.`,
    );
  }

  return value;
}

/**
 * Resolve test database selection without ever falling back to DATABASE_URL.
 * Ordinary unit tests that do not request DB integration get a deliberately
 * unreachable loopback endpoint, so accidental DB use fails locally.
 */
export function resolveTestDatabaseUrl(input: {
  readonly testDatabaseUrl: string | undefined;
  readonly integrationRequested: boolean;
}): string {
  if (!input.integrationRequested) {
    return DISABLED_TEST_DATABASE_URL;
  }
  return validateTestDatabaseUrl(input.testDatabaseUrl);
}

/** True only when a caller explicitly requested database integration tests. */
export function databaseIntegrationRequested(
  environment: Readonly<Record<string, string | undefined>>,
): boolean {
  const flag = environment.EMORA_RUN_DB_INTEGRATION;
  if (flag === undefined || flag === '') return false;
  if (flag !== '1') {
    throw new UnsafeTestDatabaseUrlError(
      'EMORA_RUN_DB_INTEGRATION must be exactly "1" when set.',
    );
  }
  return true;
}

/**
 * Integration suites use this instead of reading DATABASE_URL. No explicit
 * opt-in means the suite is skipped; an explicit opt-in requires and validates
 * TEST_DATABASE_URL.
 */
export function integrationTestDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined {
  if (!databaseIntegrationRequested(environment)) return undefined;
  return validateTestDatabaseUrl(environment.TEST_DATABASE_URL);
}

/**
 * Pin DATABASE_URL for a test process before the runtime client is imported.
 * Explicit opt-in: DATABASE_URL becomes the validated TEST_DATABASE_URL, or the
 * call throws without writing anything. No opt-in: DATABASE_URL becomes an
 * unreachable loopback endpoint, so ambient or production values are discarded.
 */
export function configureTestDatabaseEnvironment(
  environment: Record<string, string | undefined>,
): void {
  environment.DATABASE_URL = resolveTestDatabaseUrl({
    testDatabaseUrl: environment.TEST_DATABASE_URL,
    integrationRequested: databaseIntegrationRequested(environment),
  });
}
