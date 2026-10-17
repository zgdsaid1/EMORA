import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import { vi } from 'vitest';

import { LoginNavigation } from './auth-navigation';
import {
  allNavigationItems,
  findCurrentNavigationItem,
  findNavigationItem,
  isNavigationItemCurrent,
  navigationCatalog,
  navigationHref,
  STATE_HISTORY_VIEW,
} from './catalog';
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
const commandPaletteSource = shellSource.match(
  /function CommandPalette[\s\S]*?function ContextValue/,
)?.[0];
const sidebarSource = shellSource.match(
  /function Sidebar[\s\S]*?function ApplicationShellContent/,
)?.[0];

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
      'stateHistory',
    ]);
    expect(new Set(available.map((item) => item.href))).toEqual(new Set(['/', '/app']));
    expect(findNavigationItem('/ml/model-registry')?.available).toBe(false);
    expect(findNavigationItem('/research/evidence')?.available).toBe(false);
  });

  it('preserves context and marks State History active', () => {
    const stateHistory = allNavigationItems.find(
      (item) => item.key === 'stateHistory',
    );
    const currentState = allNavigationItems.find(
      (item) => item.key === 'currentState',
    );
    const modelVersions = allNavigationItems.find(
      (item) => item.key === 'modelVersions',
    );

    expect(stateHistory).toMatchObject({ href: '/app', available: true });
    expect(
      navigationHref(stateHistory!, {
        projectId: 'project-123',
        profileId: 'profile-456',
      }),
    ).toBe(
      '/app?projectId=project-123&profileId=profile-456&view=state-history',
    );
    expect(navigationHref(stateHistory!)).toBe('/app?view=state-history');
    expect(
      isNavigationItemCurrent(stateHistory!, '/app', STATE_HISTORY_VIEW),
    ).toBe(true);
    expect(isNavigationItemCurrent(stateHistory!, '/app')).toBe(false);
    expect(findCurrentNavigationItem('/app', STATE_HISTORY_VIEW)?.key).toBe(
      'stateHistory',
    );
    expect(findCurrentNavigationItem('/app')?.key).not.toBe('stateHistory');
    expect(
      isNavigationItemCurrent(currentState!, '/app', STATE_HISTORY_VIEW),
    ).toBe(false);
    expect(modelVersions).toMatchObject({
      href: '/state-engine/model-versions',
      available: false,
    });
    const locales: Locale[] = ['en', 'fr', 'ar'];
    for (const locale of locales) {
      expect(
        translate(locale, modelVersions!.available ? 'implemented' : 'planned'),
      ).toBe(messages[locale].planned);
      expect(
        translate(locale, stateHistory!.available ? 'implemented' : 'planned'),
      ).toBe(messages[locale].implemented);
    }
  });

  it('marks State History active in both sidebar layouts and command search', () => {
    expect(sidebarSource).toContain('section.items.find((item) =>');
    expect(sidebarSource).toMatch(
      /aria-current=\{\s*isNavigationItemCurrent\(destination, pathname, activeView\)\s*\?/,
    );
    expect(sidebarSource).toContain(
      "className={current ? 'is-current' : undefined}",
    );
    expect(sidebarSource).toContain('className="collapsed-nav-item"');
    expect(commandPaletteSource).toContain('isNavigationItemCurrent(');
    expect(commandPaletteSource).toContain('aria-current={');
    expect(commandPaletteSource).toContain("item.key === 'stateHistory'");
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

  it('keeps search-param state behind its required Suspense boundary', () => {
    expect(shellSource).toContain('useSearchParams');
    expect(shellSource).toContain('<Suspense fallback={null}>');
    expect(shellSource).toContain(
      '<ApplicationShellContent>{children}</ApplicationShellContent>',
    );
  });
});
