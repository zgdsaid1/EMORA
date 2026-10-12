import { describe, expect, it } from 'vitest';

import {
  databaseIntegrationRequested,
  PRODUCTION_SUPABASE_PROJECT_REF,
  integrationTestDatabaseUrl,
  resolveTestDatabaseUrl,
  UnsafeTestDatabaseUrlError,
  validateTestDatabaseUrl,
} from './test-database-url';

const LOCAL_TEST_URL =
  'postgresql://emora:emora_test_only@localhost:5433/emora_test';
const CI_TEST_URL =
  'postgresql://emora:emora_ci@127.0.0.1:5432/emora_test';

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

    expect(integrationTestDatabaseUrl(productionApplicationEnvironment)).toBeUndefined();
    expect(() =>
      integrationTestDatabaseUrl({
        ...productionApplicationEnvironment,
        EMORA_RUN_DB_INTEGRATION: '1',
      }),
    ).toThrow(UnsafeTestDatabaseUrlError);
    expect(resolveTestDatabaseUrl({
      testDatabaseUrl: undefined,
      integrationRequested: false,
    })).toContain('127.0.0.1:1');
  });

  it('rejects empty URLs and unsupported protocols', () => {
    expect(() => validateTestDatabaseUrl('')).toThrow(UnsafeTestDatabaseUrlError);
    expect(() =>
      validateTestDatabaseUrl(
        'mysql://emora:emora_test_only@localhost:5433/emora_test',
      ),
    ).toThrow(UnsafeTestDatabaseUrlError);
  });

  it('rejects the authoritative Production project in a Supavisor username', () => {
    const productionUrl =
      `postgresql://postgres.${PRODUCTION_SUPABASE_PROJECT_REF}:redacted@localhost:5432/emora_test`;
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
    expect(() =>
      validateTestDatabaseUrl(`${LOCAL_TEST_URL}#fragment`),
    ).toThrow(UnsafeTestDatabaseUrlError);
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
      databaseIntegrationRequested(
        { EMORA_RUN_DB_INTEGRATION: '1' },
      ),
    ).toBe(true);
    expect(
      databaseIntegrationRequested({ CI: 'true' }),
    ).toBe(false);
  });
});