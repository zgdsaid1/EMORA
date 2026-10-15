import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolveStoredLocale, syncDocumentLocale } from './preferences';

const preferenceSource = readFileSync(
  fileURLToPath(new URL('./preferences.tsx', import.meta.url)),
  'utf8',
);

describe('persisted language preference', () => {
  it.each([
    ['en', 'en', 'ltr'],
    ['fr', 'fr', 'ltr'],
    ['ar', 'ar', 'rtl'],
    ['invalid', 'en', 'ltr'],
    [null, 'en', 'ltr'],
  ] as const)(
    'resolves %s to locale %s and direction %s',
    (storedValue, expectedLocale, expectedDirection) => {
      const locale = resolveStoredLocale(storedValue);
      const documentElement = { lang: '', dir: '' };

      syncDocumentLocale(locale, documentElement);

      expect(locale).toBe(expectedLocale);
      expect(documentElement).toEqual({
        lang: expectedLocale,
        dir: expectedDirection,
      });
    },
  );

  it('hydrates and synchronizes the document in an isomorphic layout effect', () => {
    expect(preferenceSource).toContain(
      "typeof window === 'undefined' ? useEffect : useLayoutEffect",
    );
    const hydrationEffect = preferenceSource.match(
      /useHydrationLayoutEffect\(\(\) => \{([\s\S]*?)\n\s+\}, \[\]\);/,
    );
    expect(hydrationEffect).not.toBeNull();
    expect(hydrationEffect?.[1]).toContain('resolveStoredLocale');
    expect(hydrationEffect?.[1]).toContain(
      'syncDocumentLocale(storedLocale, document.documentElement)',
    );
    expect(hydrationEffect?.[1]).toContain('setHydrated(true)');
    expect(preferenceSource).toContain(
      'syncDocumentLocale(locale, document.documentElement)',
    );
    expect(preferenceSource).toContain(
      '[appearance, hydrated, locale, sidebarCollapsed]',
    );
  });
});
