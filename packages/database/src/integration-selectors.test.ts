import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  callsImportedFunction,
  callsValidatedDatabaseSelector,
  configHasSafetySetup,
  inventorySourceFiles,
  isDatabaseIntegrationSuite,
  isTestSource,
  readsRuntimeDatabaseUrl,
  sourceFileAt,
  unguardedDatabaseSuites,
} from './integration-test-inventory';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const VITEST_CONFIGS = [
  {
    path: 'packages/database/vitest.config.ts',
    setupFile: './src/test-setup.ts',
  },
  {
    path: 'packages/auth/vitest.config.ts',
    setupFile: '@emora/database/test-setup',
  },
  {
    path: 'apps/web/vitest.config.ts',
    setupFile: '@emora/database/test-setup',
  },
] as const;

const sourceFiles = inventorySourceFiles(REPOSITORY_ROOT);
const testSources = sourceFiles.filter(({ path }) => isTestSource(path));

describe('integration and E2E database selectors', () => {
  it('requires the safety setup in every Vitest package config', () => {
    const missingSetup = VITEST_CONFIGS.filter(({ path, setupFile }) => {
      const source = readFileSync(join(REPOSITORY_ROOT, path), 'utf8');
      return !configHasSafetySetup(source, path, setupFile);
    }).map(({ path }) => path);

    expect(missingSetup).toEqual([]);

    const setupRemoved = `
      export default defineConfig({ test: { setupFiles: [] } });
    `;
    expect(
      configHasSafetySetup(
        setupRemoved,
        'packages/auth/vitest.config.ts',
        '@emora/database/test-setup',
      ),
    ).toBe(false);
  });

  it('resolves every configured setup to the database safety module', () => {
    const databasePackage = JSON.parse(
      readFileSync(
        join(REPOSITORY_ROOT, 'packages/database/package.json'),
        'utf8',
      ),
    ) as { exports: Record<string, string> };
    const exportedSetup = databasePackage.exports['./test-setup'];
    expect(exportedSetup).toBe('./src/test-setup.ts');

    const setupPath = resolve(
      REPOSITORY_ROOT,
      'packages/database',
      exportedSetup,
    );
    expect(existsSync(setupPath)).toBe(true);

    const setupModule = sourceFileAt(
      REPOSITORY_ROOT,
      'packages/database/src/test-setup.ts',
    );
    expect(
      callsImportedFunction(
        setupModule,
        './test-database-url',
        'configureTestDatabaseEnvironment',
      ),
    ).toBe(true);
  });

  it('discovers database-backed tests outside old roots and filename patterns', () => {
    const addedSuite = {
      path: 'services/new-package/src/customer-db.spec.ts',
      source: "import postgres from 'postgres';",
    };

    expect(isDatabaseIntegrationSuite(addedSuite)).toBe(true);
    expect(unguardedDatabaseSuites([addedSuite])).toEqual([
      'services/new-package/src/customer-db.spec.ts',
    ]);

    const alternateEndToEndName = {
      path: 'services/new-package/src/customer-flow.e2e.ts',
      source: "import postgres from 'postgres';",
    };
    expect(isDatabaseIntegrationSuite(alternateEndToEndName)).toBe(true);
    expect(unguardedDatabaseSuites([alternateEndToEndName])).toEqual([
      'services/new-package/src/customer-flow.e2e.ts',
    ]);

    const bypassedSelector = {
      ...addedSuite,
      source: `
        import postgres from 'postgres';
        const databaseUrl = process.env.DATABASE_URL;
      `,
    };
    expect(unguardedDatabaseSuites([bypassedSelector])).toEqual([
      'services/new-package/src/customer-db.spec.ts',
    ]);
  });

  it('requires the validated helper call rather than its name appearing in text', () => {
    const bypassedSelector = {
      path: 'apps/web/server/feature.integration.test.ts',
      source: `
        import postgres from 'postgres';
        const example = 'integrationTestDatabaseUrl(process.env)';
        const client = postgres(process.env.DATABASE_URL);
      `,
    };
    expect(callsValidatedDatabaseSelector(bypassedSelector)).toBe(false);
    expect(unguardedDatabaseSuites([bypassedSelector])).toEqual([
      'apps/web/server/feature.integration.test.ts',
    ]);

    const selectedSuite = {
      ...bypassedSelector,
      source: `
        import postgres from 'postgres';
        import { integrationTestDatabaseUrl as selectTestDatabase }
          from '@emora/database/test-database-url';
        const databaseUrl = selectTestDatabase(process.env);
        const client = databaseUrl ? postgres(databaseUrl) : null;
      `,
    };
    expect(callsValidatedDatabaseSelector(selectedSuite)).toBe(true);
    expect(unguardedDatabaseSuites([selectedSuite])).toEqual([]);
  });

  it('every repository-wide database integration suite uses the selector', () => {
    const suites = sourceFiles.filter(isDatabaseIntegrationSuite);
    expect(suites.length).toBeGreaterThanOrEqual(11);
    expect(unguardedDatabaseSuites(sourceFiles)).toEqual([]);
  });

  it('no test source reads DATABASE_URL directly', () => {
    const offenders = testSources
      .filter(({ path, source }) => readsRuntimeDatabaseUrl(source, path))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it('Playwright validates and forwards only the validated test URL', () => {
    const playwright = readFileSync(
      join(REPOSITORY_ROOT, 'playwright.config.ts'),
      'utf8',
    );

    expect(playwright).toContain('validateTestDatabaseUrl(');
    expect(readsRuntimeDatabaseUrl(playwright, 'playwright.config.ts')).toBe(
      false,
    );
    expect(playwright).toContain('DATABASE_URL: testDatabaseUrl');
    expect(playwright).toContain('TEST_DATABASE_URL: testDatabaseUrl');
  });

  it('Turbo test task receives the test URL and explicit integration opt-in', () => {
    const turbo = JSON.parse(
      readFileSync(join(REPOSITORY_ROOT, 'turbo.json'), 'utf8'),
    ) as { tasks: { test: { env: string[] } } };

    expect(turbo.tasks.test.env).toContain('TEST_DATABASE_URL');
    expect(turbo.tasks.test.env).toContain('EMORA_RUN_DB_INTEGRATION');
    expect(turbo.tasks.test.env).not.toContain('DATABASE_URL');
  });

  it('CI validate job creates and migrates its local DB before verbose integration tests', () => {
    const workflow = readFileSync(
      join(REPOSITORY_ROOT, '.github/workflows/ci.yml'),
      'utf8',
    );
    const validateStart = workflow.indexOf('  validate:');
    const nextJob = workflow.indexOf('\n  product-reality-e2e:', validateStart);
    const validateJob = workflow.slice(validateStart, nextJob);
    const createDatabase = validateJob.indexOf(
      'CREATE DATABASE emora_test OWNER emora',
    );
    const migrateDatabase = validateJob.indexOf(
      'db:migrate:test',
      createDatabase,
    );
    const runTests = validateJob.indexOf(
      'turbo run test -- --reporter=verbose',
      migrateDatabase,
    );

    expect(validateStart).toBeGreaterThanOrEqual(0);
    expect(nextJob).toBeGreaterThan(validateStart);
    expect(validateJob).toContain("EMORA_RUN_DB_INTEGRATION: '1'");
    expect(validateJob).toMatch(
      /TEST_DATABASE_URL:[^\n]*localhost:5432\/emora_test/,
    );
    expect(validateJob).toContain('POSTGRES_DB: postgres');
    expect(createDatabase).toBeGreaterThanOrEqual(0);
    expect(migrateDatabase).toBeGreaterThan(createDatabase);
    expect(runTests).toBeGreaterThan(migrateDatabase);
  });
});
