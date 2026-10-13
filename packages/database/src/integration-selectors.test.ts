import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Static selector guard. Test and E2E sources must reach the database only
 * through the validated TEST_DATABASE_URL path; direct DATABASE_URL reads and
 * unguarded integration suites fail here before any database is contacted.
 */

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const TEST_SOURCE_ROOTS = [
  'apps/web',
  'packages/auth/src',
  'packages/database/src',
  'tests/e2e',
];
// Split literal keeps this guard from matching its own source text.
const DIRECT_DATABASE_URL_READ = 'process.env.' + 'DATABASE_URL';
const VALIDATED_SELECTOR = 'integrationTestDatabaseUrl(';

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.next') return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const sources = TEST_SOURCE_ROOTS.flatMap((root) =>
  listSourceFiles(join(REPOSITORY_ROOT, root)),
).map((path) => ({
  path: relative(REPOSITORY_ROOT, path),
  source: readFileSync(path, 'utf8'),
}));

const isTestSource = (path: string) => /\.(test|spec)\.tsx?$/.test(path);
// A database suite is a file named as an integration test that imports a
// database client. Source-scan tests that merely match the name are excluded.
const isIntegrationSuite = (path: string, source: string) =>
  /(^|[./-])integration\.test\.ts$/.test(path) &&
  (source.includes("from '@emora/database") ||
    source.includes("from 'postgres'") ||
    source.includes("from './schema'"));

describe('integration and E2E database selectors', () => {
  it('no test or E2E source reads DATABASE_URL directly', () => {
    const offenders = sources
      .filter(({ path }) => isTestSource(path))
      .filter(({ source }) => source.includes(DIRECT_DATABASE_URL_READ))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it('every integration suite selects its database through the validated helper', () => {
    const suites = sources.filter(({ path, source }) =>
      isIntegrationSuite(path, source),
    );
    const unguarded = suites
      .filter(({ source }) => !source.includes(VALIDATED_SELECTOR))
      .map(({ path }) => path);

    expect(suites.length).toBeGreaterThanOrEqual(11);
    expect(unguarded).toEqual([]);
  });

  it('Playwright config validates the test URL and never forwards DATABASE_URL', () => {
    const playwright = readFileSync(
      join(REPOSITORY_ROOT, 'playwright.config.ts'),
      'utf8',
    );

    expect(playwright).toContain('validateTestDatabaseUrl(');
    expect(playwright).not.toContain(DIRECT_DATABASE_URL_READ);
  });

  it('Turbo test task receives TEST_DATABASE_URL and not DATABASE_URL', () => {
    const turbo = JSON.parse(
      readFileSync(join(REPOSITORY_ROOT, 'turbo.json'), 'utf8'),
    ) as { tasks: { test: { env: string[] } } };

    expect(turbo.tasks.test.env).toContain('TEST_DATABASE_URL');
    expect(turbo.tasks.test.env).toContain('EMORA_RUN_DB_INTEGRATION');
    expect(turbo.tasks.test.env).not.toContain('DATABASE_URL');
  });
});
