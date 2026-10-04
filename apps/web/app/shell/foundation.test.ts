import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import { vi } from 'vitest';

import { LoginNavigation } from './auth-navigation';
import { allNavigationItems, findNavigationItem, navigationCatalog } from './catalog';
import { navigationLabel } from './navigation-messages';
import { messages, translate, type Locale } from './messages';

type ReactGlobal = typeof globalThis & { React?: typeof React };

vi.mock('./preferences', () => ({
  usePreferences: () => ({
    t: (key: string) =>
      key === 'forgotPassword' ? 'Forgot password?' : 'Create account',
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    (globalThis as ReactGlobal).React!.createElement('a', { href }, children),
}));

const shellSource = readFileSync(
  fileURLToPath(new URL('./application-shell.tsx', import.meta.url)),
  'utf8',
);

describe('design foundation catalog', () => {
  it('includes the complete 18-section product map', () => {
    expect(navigationCatalog).toHaveLength(18);
    expect(navigationCatalog.every((section) => section.items.length > 0)).toBe(true);
  });

  it('provides a non-empty translation for every section and module in English, French, and Arabic', () => {
    const locales: Locale[] = ['en', 'fr', 'ar'];
    for (const locale of locales) {
      for (const section of navigationCatalog) {
        expect(navigationLabel(locale, section.key)).not.toBe('');
        for (const item of section.items) {
          expect(navigationLabel(locale, item.key)).not.toBe('');
        }
      }
      expect(Object.keys(messages[locale]).sort()).toEqual(Object.keys(messages.en).sort());
      expect(messages[locale].forgotPassword).not.toBe('');
    }
  });

  it('exposes the existing password-recovery route from login navigation', () => {
    const globalWithReact = globalThis as ReactGlobal;
    const previousReact = globalWithReact.React;
    globalWithReact.React = React;

    try {
      const markup = renderToStaticMarkup(React.createElement(LoginNavigation));
      expect(markup).toContain('<a href="/forgot-password">Forgot password?</a>');
    } finally {
      globalWithReact.React = previousReact;
    }
  });

  it('marks only existing UI routes as available', () => {
    const available = allNavigationItems.filter((item) => item.available);
    expect(available.map((item) => item.key).sort()).toEqual([
      'currentState',
      'overview',
      'profiles',
      'projects',
    ]);
    expect(new Set(available.map((item) => item.href))).toEqual(new Set(['/', '/app']));
    expect(findNavigationItem('/ml/model-registry')?.available).toBe(false);
    expect(findNavigationItem('/research/evidence')?.available).toBe(false);
  });

  it('uses English as the fallback dictionary and preserves explicit data-state distinctions', () => {
    expect(translate('en', 'noData')).toBe('No data');
    expect(translate('en', 'unknown')).toBe('Unknown');
    expect(translate('en', 'notEvaluable')).toBe('Not evaluable');
    expect(translate('en', 'error')).toBe('Error');
  });

  it('routes the public auth pages (incl. /reset-password) to the auth shell', () => {
    // F3: /reset-password must be classified as an authentication route so it
    // uses the auth frame, not the authenticated workspace shell. All public
    // auth routes must share this classification consistently.
    const classification = shellSource.match(
      /function isAuthRoute[\s\S]*?includes\(pathname\)/,
    );
    expect(classification).not.toBeNull();
    const body = classification![0];
    for (const route of [
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
    ]) {
      expect(body).toContain(`'${route}'`);
    }
    // The authenticated workspace must never be classified as an auth route.
    expect(body).not.toContain("'/app'");
  });
});