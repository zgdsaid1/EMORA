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

interface WorkflowStep {
  readonly name: string;
  readonly run: string;
}

function indentation(line: string): number {
  return line.match(/^ */)?.[0].length ?? 0;
}

function workflowJobSource(workflow: string, jobName: string): string {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${jobName}:`);
  if (start < 0) return '';

  const end = lines.findIndex(
    (line, index) => index > start && /^ {2}[\w-]+:/.test(line),
  );
  return lines
    .slice(start, end < 0 ? undefined : end)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

function workflowJobSteps(workflow: string, jobName: string): WorkflowStep[] {
  const lines = workflow.split(/\r?\n/);
  const jobStart = lines.findIndex((line) => line === `  ${jobName}:`);
  if (jobStart < 0) return [];

  const jobEnd = lines.findIndex(
    (line, index) => index > jobStart && /^ {2}[\w-]+:/.test(line),
  );
  const jobLines = lines.slice(jobStart, jobEnd < 0 ? undefined : jobEnd);
  const stepsIndex = jobLines.findIndex((line) => line === '    steps:');
  if (stepsIndex < 0) return [];

  const steps: WorkflowStep[] = [];
  let index = stepsIndex + 1;
  while (index < jobLines.length) {
    const stepStart = jobLines[index];
    if (indentation(stepStart) <= 4 && stepStart.trim() !== '') break;
    if (/^\s*#/.test(stepStart) || !/^ {6}- /.test(stepStart)) {
      index += 1;
      continue;
    }

    let name = '';
    let run = '';
    const inlineName = stepStart.match(/^ {6}- name:\s*(.*)$/);
    const inlineRun = stepStart.match(/^ {6}- run:\s*(.*)$/);
    if (inlineName) name = inlineName[1].trim();
    if (inlineRun) run = inlineRun[1].trim();

    index += 1;
    while (
      index < jobLines.length &&
      (jobLines[index].trim() === '' || indentation(jobLines[index]) > 6)
    ) {
      const line = jobLines[index];
      if (/^\s*#/.test(line) && indentation(line) <= 8) {
        index += 1;
        continue;
      }

      const nameMatch = line.match(/^ {8}name:\s*(.*)$/);
      if (nameMatch) name = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');

      const runMatch = line.match(/^ {8}run:\s*(.*)$/);
      if (!runMatch) {
        index += 1;
        continue;
      }

      const scalar = runMatch[1].trim();
      if (/^[>|][+-]?$/.test(scalar)) {
        const blockLines: string[] = [];
        index += 1;
        while (index < jobLines.length) {
          const blockLine = jobLines[index];
          if (blockLine.trim() !== '' && indentation(blockLine) <= 8) break;
          blockLines.push(blockLine.trim());
          index += 1;
        }
        run = scalar.startsWith('>')
          ? blockLines.join(' ')
          : blockLines.join('\n');
        break;
      }

      run = scalar.replace(/^(['"])(.*)\1$/, '$2');
      index += 1;
    }

    steps.push({ name, run });
  }
  return steps;
}

function activeShellCommand(command: string): string {
  let output = '';
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (escaped) {
      output += character;
      escaped = false;
      continue;
    }
    if (character === '\\' && quote !== "'") {
      output += character;
      escaped = true;
      continue;
    }
    if (quote) {
      output += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      output += character;
      continue;
    }
    if (character === '#' && (index === 0 || /\s/.test(command[index - 1]))) {
      while (index < command.length && command[index] !== '\n') index += 1;
      output += '\n';
      continue;
    }
    output += character;
  }

  return output.trim();
}

function shellCommands(command: string): string[][] {
  const source = activeShellCommand(command);
  const commands: string[][] = [];
  let words: string[] = [];
  let word = '';
  let wordStarted = false;
  let quote: "'" | '"' | null = null;
  let escaped = false;

  const pushWord = (): void => {
    if (!wordStarted) return;
    words.push(word);
    word = '';
    wordStarted = false;
  };
  const finishCommand = (): void => {
    pushWord();
    if (words.length > 0) commands.push(words);
    words = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      if (character !== '\n') word += character;
      escaped = false;
      continue;
    }
    if (character === '\\' && quote !== "'") {
      if (source[index + 1] === '\n') {
        index += 1;
      } else {
        escaped = true;
        wordStarted = true;
      }
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      else word += character;
      wordStarted = true;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      wordStarted = true;
      continue;
    }
    if (/\s/.test(character)) {
      pushWord();
      if (character === '\n') finishCommand();
      continue;
    }
    if (character === ';' || character === '|' || character === '&') {
      finishCommand();
      while (source[index + 1] === character) index += 1;
      continue;
    }
    word += character;
    wordStarted = true;
  }

  finishCommand();
  return commands;
}

function hasShellInvocation(
  command: string,
  expectedArguments: readonly string[],
): boolean {
  const commands = shellCommands(command);
  return (
    commands.length === 1 &&
    commands[0].length === expectedArguments.length &&
    expectedArguments.every(
      (argument, index) => commands[0][index] === argument,
    )
  );
}

function ciDatabaseIntegrationWiringErrors(workflow: string): string[] {
  const job = workflowJobSource(workflow, 'validate');
  const steps = workflowJobSteps(workflow, 'validate');
  const commandFor = (name: string): string =>
    steps.find((step) => step.name === name)?.run ?? '';
  const createCommand = commandFor('Create isolated test database');
  const verifyCommand = commandFor('Verify database integration CI wiring');
  const migrateIndex = steps.findIndex((step) =>
    hasShellInvocation(step.run, [
      'pnpm',
      '--filter',
      '@emora/database',
      'db:migrate:test',
    ]),
  );
  const verifyIndex = steps.findIndex(
    (step) => step.name === 'Verify database integration CI wiring',
  );
  const suiteIndex = steps.findIndex((step) =>
    hasShellInvocation(step.run, [
      'pnpm',
      'exec',
      'turbo',
      'run',
      'test',
      '--',
      '--reporter=verbose',
    ]),
  );
  const createIndex = steps.findIndex(
    (step) => step.name === 'Create isolated test database',
  );

  const errors: string[] = [];
  if (!job.includes("EMORA_RUN_DB_INTEGRATION: '1'")) {
    errors.push('validate job must explicitly opt in to database integration');
  }
  if (!/TEST_DATABASE_URL:[^\n]*localhost:5432\/emora_test/.test(job)) {
    errors.push('validate job must target its local emora_test database');
  }
  if (!job.includes('POSTGRES_DB: postgres')) {
    errors.push('validate PostgreSQL service must start outside emora_test');
  }
  if (
    !hasShellInvocation(createCommand, [
      'docker',
      'exec',
      '${{ job.services.postgres.id }}',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'emora',
      '-d',
      'postgres',
      '-c',
      'CREATE DATABASE emora_test OWNER emora',
    ])
  ) {
    errors.push('validate job must actively create emora_test');
  }
  if (createIndex < 0 || migrateIndex <= createIndex) {
    errors.push('validate job must create emora_test before migrating it');
  }
  if (
    !hasShellInvocation(verifyCommand, [
      'pnpm',
      '--filter',
      '@emora/database',
      'exec',
      'vitest',
      'run',
      'src/integration-selectors.test.ts',
      '--reporter=verbose',
    ])
  ) {
    errors.push('validate job must actively run the database CI wiring guard');
  }
  if (verifyIndex < migrateIndex || verifyIndex < 0) {
    errors.push('database CI wiring guard must run after test migrations');
  }
  if (suiteIndex <= verifyIndex || suiteIndex < 0) {
    errors.push(
      'validate job must run the full test suite after the wiring guard',
    );
  }
  return errors;
}

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

  it('CI validate job actively creates and migrates its local DB before integration tests', () => {
    const workflow = readFileSync(
      join(REPOSITORY_ROOT, '.github/workflows/ci.yml'),
      'utf8',
    );
    expect(ciDatabaseIntegrationWiringErrors(workflow)).toEqual([]);
  });

  it('detects commented-out database creation and full-suite invocations', () => {
    const workflow = readFileSync(
      join(REPOSITORY_ROOT, '.github/workflows/ci.yml'),
      'utf8',
    );
    const testInvocation =
      '        run: pnpm exec turbo run test -- --reporter=verbose';
    const commentedTestInvocation = workflow.replace(
      testInvocation,
      `        #${testInvocation.trimStart()}`,
    );
    expect(commentedTestInvocation).not.toBe(workflow);
    expect(
      ciDatabaseIntegrationWiringErrors(commentedTestInvocation),
    ).toContain(
      'validate job must run the full test suite after the wiring guard',
    );

    const createInvocation =
      '          -c "CREATE DATABASE emora_test OWNER emora"';
    const commentedCreateInvocation = workflow.replace(
      createInvocation,
      '          # -c "CREATE DATABASE emora_test OWNER emora"',
    );
    expect(commentedCreateInvocation).not.toBe(workflow);
    expect(
      ciDatabaseIntegrationWiringErrors(commentedCreateInvocation),
    ).toContain('validate job must actively create emora_test');
  });

  it('rejects echoed, wrapped, and shell-commented required commands', () => {
    const workflow = readFileSync(
      join(REPOSITORY_ROOT, '.github/workflows/ci.yml'),
      'utf8',
    );
    const testInvocation =
      '        run: pnpm exec turbo run test -- --reporter=verbose';
    const mutations = [
      '        run: echo "pnpm exec turbo run test -- --reporter=verbose"',
      '        run: bash -c "pnpm exec turbo run test -- --reporter=verbose"',
      '        run: echo ok # pnpm exec turbo run test -- --reporter=verbose',
    ];
    for (const replacement of mutations) {
      const mutated = workflow.replace(testInvocation, replacement);
      expect(mutated).not.toBe(workflow);
      expect(ciDatabaseIntegrationWiringErrors(mutated)).toContain(
        'validate job must run the full test suite after the wiring guard',
      );
    }
  });

  it('rejects logical-shell forms that can skip or mask the test command', () => {
    const workflow = readFileSync(
      join(REPOSITORY_ROOT, '.github/workflows/ci.yml'),
      'utf8',
    );
    const testInvocation =
      '        run: pnpm exec turbo run test -- --reporter=verbose';
    const mutations = [
      '        run: echo ok || pnpm exec turbo run test -- --reporter=verbose',
      '        run: pnpm exec turbo run test -- --reporter=verbose || echo ok',
    ];
    for (const replacement of mutations) {
      const mutated = workflow.replace(testInvocation, replacement);
      expect(mutated).not.toBe(workflow);
      expect(ciDatabaseIntegrationWiringErrors(mutated)).toContain(
        'validate job must run the full test suite after the wiring guard',
      );
    }
  });

  it('rejects echo in place of the database-creation command', () => {
    const workflow = readFileSync(
      join(REPOSITORY_ROOT, '.github/workflows/ci.yml'),
      'utf8',
    );
    const createCommand = `        run: >-
          docker exec "\${{ job.services.postgres.id }}"
          psql -v ON_ERROR_STOP=1 -U emora -d postgres
          -c "CREATE DATABASE emora_test OWNER emora"`;
    const mutated = workflow.replace(
      createCommand,
      '        run: echo "CREATE DATABASE emora_test OWNER emora"',
    );
    expect(mutated).not.toBe(workflow);
    expect(ciDatabaseIntegrationWiringErrors(mutated)).toContain(
      'validate job must actively create emora_test',
    );
  });
});
