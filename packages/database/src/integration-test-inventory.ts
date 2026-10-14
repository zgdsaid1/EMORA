import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';

import * as ts from 'typescript';

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.kilo',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
]);
const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);

export interface SourceFile {
  readonly path: string;
  readonly source: string;
}

function parseSource(source: string, path: string): ts.SourceFile {
  const scriptKind =
    path.endsWith('.tsx') || path.endsWith('.jsx')
      ? ts.ScriptKind.TSX
      : path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs')
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  return ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
}

export function inventorySourceFiles(root: string): SourceFile[] {
  const visit = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isDirectory()) {
        return IGNORED_DIRECTORIES.has(entry.name)
          ? []
          : visit(join(directory, entry.name));
      }

      return SOURCE_EXTENSIONS.has(extname(entry.name))
        ? [join(directory, entry.name)]
        : [];
    });

  return visit(root).map((absolutePath) => ({
    path: relative(root, absolutePath).replaceAll('\\', '/'),
    source: readFileSync(absolutePath, 'utf8'),
  }));
}

function moduleSpecifiers(sourceFile: SourceFile): string[] {
  const modules: string[] = [];
  const ast = parseSource(sourceFile.source, sourceFile.path);

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      modules.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require')) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      modules.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };

  visit(ast);
  return modules;
}

function importsDatabaseClient(sourceFile: SourceFile): boolean {
  return moduleSpecifiers(sourceFile).some(
    (specifier) =>
      specifier === 'postgres' ||
      specifier === 'pg' ||
      specifier === 'drizzle-orm/postgres-js' ||
      specifier === 'drizzle-orm/node-postgres' ||
      (specifier.startsWith('@emora/database') &&
        !specifier.endsWith('/test-database-url') &&
        !specifier.endsWith('/test-setup')),
  );
}

export function isTestSource(path: string): boolean {
  const filename = basename(path);
  return (
    /(?:^|[._-])(?:test|spec|integration|e2e)(?:[._-]|$)/i.test(filename) ||
    /(?:^|\/)(?:__tests__|tests?|e2e)(?:\/|$)/i.test(path)
  );
}

export function isDatabaseIntegrationSuite(sourceFile: SourceFile): boolean {
  const integrationNamed =
    /\.integration\./i.test(basename(sourceFile.path)) ||
    /(?:^|\/)integration(?:\/|$)/i.test(sourceFile.path);
  return (
    isTestSource(sourceFile.path) &&
    (integrationNamed || importsDatabaseClient(sourceFile))
  );
}

function importedBindings(
  sourceFile: SourceFile,
  modulePath: string,
  importedName: string,
): Set<string> {
  const bindings = new Set<string>();
  const ast = parseSource(sourceFile.source, sourceFile.path);

  for (const statement of ast.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== modulePath ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }

    for (const element of statement.importClause.namedBindings.elements) {
      if (
        element.propertyName?.text === importedName ||
        element.name.text === importedName
      ) {
        bindings.add(element.name.text);
      }
    }
  }

  return bindings;
}

export function callsValidatedDatabaseSelector(
  sourceFile: SourceFile,
): boolean {
  const bindings = new Set([
    ...importedBindings(
      sourceFile,
      '@emora/database/test-database-url',
      'integrationTestDatabaseUrl',
    ),
    ...importedBindings(
      sourceFile,
      './test-database-url',
      'integrationTestDatabaseUrl',
    ),
  ]);
  if (bindings.size === 0) return false;

  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      bindings.has(node.expression.text)
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(parseSource(sourceFile.source, sourceFile.path));
  return found;
}

export function unguardedDatabaseSuites(
  sourceFiles: readonly SourceFile[],
): string[] {
  return sourceFiles
    .filter(isDatabaseIntegrationSuite)
    .filter((sourceFile) => !callsValidatedDatabaseSelector(sourceFile))
    .map(({ path }) => path);
}

export function readsRuntimeDatabaseUrl(source: string, path: string): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'DATABASE_URL' &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'env' &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'process'
    ) {
      found = true;
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteral(node.argumentExpression) &&
      node.argumentExpression.text === 'DATABASE_URL' &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'env' &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'process'
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(parseSource(source, path));
  return found;
}

export function setupFilesInConfig(source: string, path: string): string[] {
  const ast = parseSource(source, path);
  const exported = ast.statements.find(ts.isExportAssignment);
  if (!exported) return [];

  const config = ts.isCallExpression(exported.expression)
    ? exported.expression.arguments[0]
    : exported.expression;
  if (!config || !ts.isObjectLiteralExpression(config)) return [];

  const testProperty = config.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === 'test',
  );
  if (
    !testProperty ||
    !ts.isObjectLiteralExpression(testProperty.initializer)
  ) {
    return [];
  }

  const setupProperty = testProperty.initializer.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === 'setupFiles',
  );
  if (!setupProperty) return [];

  const initializer = setupProperty.initializer;
  if (ts.isStringLiteral(initializer)) return [initializer.text];
  if (!ts.isArrayLiteralExpression(initializer)) return [];
  return initializer.elements.flatMap((element) =>
    ts.isStringLiteral(element) ? [element.text] : [],
  );
}

export function configHasSafetySetup(
  source: string,
  path: string,
  requiredSetupFile: string,
): boolean {
  return setupFilesInConfig(source, path).includes(requiredSetupFile);
}

export function callsImportedFunction(
  sourceFile: SourceFile,
  modulePath: string,
  importedName: string,
): boolean {
  const bindings = importedBindings(sourceFile, modulePath, importedName);
  if (bindings.size === 0) return false;

  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      bindings.has(node.expression.text) &&
      node.arguments.some(
        (argument) =>
          ts.isPropertyAccessExpression(argument) &&
          argument.name.text === 'env' &&
          ts.isIdentifier(argument.expression) &&
          argument.expression.text === 'process',
      )
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(parseSource(sourceFile.source, sourceFile.path));
  return found;
}

export function sourceFileAt(root: string, path: string): SourceFile {
  return {
    path,
    source: readFileSync(join(root, path), 'utf8'),
  };
}
