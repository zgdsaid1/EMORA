import { execFileSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
  configureTestDatabaseEnvironment,
  databaseIntegrationRequested,
  PRODUCTION_SUPABASE_PROJECT_REF,
  integrationTestDatabaseUrl,
  resolveTestDatabaseUrl,
  UnsafeTestDatabaseUrlError,
  validateTestDatabaseUrl,
} from './test-database-url';

const LOCAL_TEST_URL =
  'postgresql://emora:emora_test_only@localhost:5433/emora_test';
const CI_TEST_URL = 'postgresql://emora:emora_ci@127.0.0.1:5432/emora_test';

const PRODUCTION_URL = `postgresql://postgres.${PRODUCTION_SUPABASE_PROJECT_REF}:redacted@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;

describe('configureTestDatabaseEnvironment', () => {
  it('discards a production DATABASE_URL when integration is not requested', () => {
    const environment: Record<string, string | undefined> = {
      DATABASE_URL: PRODUCTION_URL,
      CI: 'true',
    };

    configureTestDatabaseEnvironment(environment);

    expect(environment.DATABASE_URL).toContain('127.0.0.1:1');
    expect(environment.DATABASE_URL).not.toContain(
      PRODUCTION_SUPABASE_PROJECT_REF,
    );
  });

  it('replaces DATABASE_URL with the validated test URL when integration is requested', () => {
    const environment: Record<string, string | undefined> = {
      DATABASE_URL: PRODUCTION_URL,
      TEST_DATABASE_URL: LOCAL_TEST_URL,
      EMORA_RUN_DB_INTEGRATION: '1',
    };

    configureTestDatabaseEnvironment(environment);

    expect(environment.DATABASE_URL).toBe(LOCAL_TEST_URL);
  });

  it('fails closed without writing a fallback when TEST_DATABASE_URL is missing', () => {
    const environment: Record<string, string | undefined> = {
      DATABASE_URL: PRODUCTION_URL,
      EMORA_RUN_DB_INTEGRATION: '1',
    };
    let error: unknown;

    try {
      configureTestDatabaseEnvironment(environment);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(UnsafeTestDatabaseUrlError);
    expect(String(error)).not.toContain(PRODUCTION_SUPABASE_PROJECT_REF);
    expect(environment.DATABASE_URL).toBe(PRODUCTION_URL);
  });

  it('rejects a remote TEST_DATABASE_URL when integration is requested', () => {
    const environment: Record<string, string | undefined> = {
      TEST_DATABASE_URL:
        'postgresql://emora:remote-only@db.example.test:5432/emora_test',
      EMORA_RUN_DB_INTEGRATION: '1',
    };

    expect(() => configureTestDatabaseEnvironment(environment)).toThrow(
      UnsafeTestDatabaseUrlError,
    );
  });

  it('passes only the validated URL to child processes', () => {
    const environment: Record<string, string | undefined> = {
      ...process.env,
      DATABASE_URL: PRODUCTION_URL,
      TEST_DATABASE_URL: LOCAL_TEST_URL,
      EMORA_RUN_DB_INTEGRATION: '1',
    };

    configureTestDatabaseEnvironment(environment);
    const childValue = execFileSync(
      process.execPath,
      ['-e', "process.stdout.write(process.env['DATABASE_URL'] ?? '')"],
      { env: environment, encoding: 'utf8' },
    );

    expect(childValue).toBe(LOCAL_TEST_URL);
  });
});

describe('integration-test database URL safety', () => {
  it('does not fall back to DATABASE_URL when TEST_DATABASE_URL is missing', () => {
    const productionApplicationEnvironment = {
      DATABASE_URL: `postgresql://postgres.${PRODUCTION_SUPABASE_PROJECT_REF}:redacted@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
    };

    expect(() =>
      resolveTestDatabaseUrl({
        testDatabaseUrl: undefined,
        integrationRequested: true,
      }),
    ).toThrow(UnsafeTestDatabaseUrlError);

    expect(
      integrationTestDatabaseUrl(productionApplicationEnvironment),
    ).toBeUndefined();
    expect(() =>
      integrationTestDatabaseUrl({
        ...productionApplicationEnvironment,
        EMORA_RUN_DB_INTEGRATION: '1',
      }),
    ).toThrow(UnsafeTestDatabaseUrlError);
    expect(
      resolveTestDatabaseUrl({
        testDatabaseUrl: undefined,
        integrationRequested: false,
      }),
    ).toContain('127.0.0.1:1');
  });

  it('rejects empty URLs and unsupported protocols', () => {
    expect(() => validateTestDatabaseUrl('')).toThrow(
      UnsafeTestDatabaseUrlError,
    );
    expect(() =>
      validateTestDatabaseUrl(
        'mysql://emora:emora_test_only@localhost:5433/emora_test',
      ),
    ).toThrow(UnsafeTestDatabaseUrlError);
  });

  it('rejects the authoritative Production project in a Supavisor username', () => {
    const productionUrl = `postgresql://postgres.${PRODUCTION_SUPABASE_PROJECT_REF}:redacted@localhost:5432/emora_test`;
    expect(() => validateTestDatabaseUrl(productionUrl)).toThrow(
      UnsafeTestDatabaseUrlError,
    );
  });

  it('accepts explicitly named loopback test PostgreSQL', () => {
    expect(validateTestDatabaseUrl(LOCAL_TEST_URL)).toBe(LOCAL_TEST_URL);
    expect(validateTestDatabaseUrl(CI_TEST_URL)).toBe(CI_TEST_URL);
    expect(
      validateTestDatabaseUrl(
        'postgresql://emora:emora_test_only@[::1]:5433/emora_test',
      ),
    ).toContain('[::1]');
  });

  it('rejects remote/unknown database identities and non-test database names', () => {
    expect(() =>
      validateTestDatabaseUrl(
        'postgresql://user:secret@unknown-db.example.test:5432/emora_test',
      ),
    ).toThrow(UnsafeTestDatabaseUrlError);
    expect(() =>
      validateTestDatabaseUrl(
        'postgresql://emora:emora_dev_only@localhost:5432/emora',
      ),
    ).toThrow(UnsafeTestDatabaseUrlError);
  });

  it('rejects unsupported ports, fragments, and query parameters', () => {
    expect(() =>
      validateTestDatabaseUrl(
        'postgresql://emora:emora_test_only@localhost:5434/emora_test',
      ),
    ).toThrow(UnsafeTestDatabaseUrlError);
    expect(() => validateTestDatabaseUrl(`${LOCAL_TEST_URL}#fragment`)).toThrow(
      UnsafeTestDatabaseUrlError,
    );
    expect(() =>
      validateTestDatabaseUrl(`${LOCAL_TEST_URL}?sslmode=require`),
    ).toThrow(UnsafeTestDatabaseUrlError);
  });

  it('rejects missing credentials and malformed percent-encoding', () => {
    expect(() =>
      validateTestDatabaseUrl('postgresql://localhost:5433/emora_test'),
    ).toThrow(UnsafeTestDatabaseUrlError);
    expect(() =>
      validateTestDatabaseUrl('postgresql://emora@localhost:5433/emora_test'),
    ).toThrow(UnsafeTestDatabaseUrlError);
    expect(() =>
      validateTestDatabaseUrl(
        'postgresql://emora%ZZ:emora_test_only@localhost:5433/emora_test',
      ),
    ).toThrow(UnsafeTestDatabaseUrlError);
  });

  it('does not expose supplied credentials in validation errors', () => {
    const secret = 'test-only-secret';
    let error: unknown;
    try {
      validateTestDatabaseUrl(
        `postgresql://emora:${secret}@remote.example.test:5433/emora_test`,
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(UnsafeTestDatabaseUrlError);
    expect(String(error)).not.toContain(secret);
  });

  it('requires the explicit integration-run flag', () => {
    expect(databaseIntegrationRequested({})).toBe(false);
    expect(
      databaseIntegrationRequested({ EMORA_RUN_DB_INTEGRATION: '1' }),
    ).toBe(true);
    expect(databaseIntegrationRequested({ CI: 'true' })).toBe(false);
  });

  it('rejects malformed non-empty integration-run flags', () => {
    for (const flag of ['true', '0', 'yes']) {
      const environment = {
        EMORA_RUN_DB_INTEGRATION: flag,
        TEST_DATABASE_URL: LOCAL_TEST_URL,
      };

      expect(() => databaseIntegrationRequested(environment)).toThrow(
        UnsafeTestDatabaseUrlError,
      );
      expect(() => integrationTestDatabaseUrl(environment)).toThrow(
        UnsafeTestDatabaseUrlError,
      );
    }
  });
});
