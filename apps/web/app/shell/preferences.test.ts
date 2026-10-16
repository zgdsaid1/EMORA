import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  persistLocalePreference,
  resolveHydratedLocale,
} from './locale-preference';
import {
  persistAppearanceAndSidebarPreferences,
  syncDocumentLocale,
} from './preferences';

describe('locale preferences', () => {
  it('initializes provider locale state from the server-resolved locale', async () => {
    const { PreferencesProvider, usePreferences } =
      await import('./preferences');
    function LocaleProbe() {
      return React.createElement('span', null, usePreferences().locale);
    }
    const markup = renderToStaticMarkup(
      React.createElement(PreferencesProvider, {
        initialLocale: 'ar',
        hasValidLocaleCookie: true,
        children: React.createElement(LocaleProbe),
      }),
    );

    expect(markup).toContain('<span>ar</span>');
  });

  it('keeps SSR on the server locale before migrating a legacy localStorage locale', async () => {
    expect(resolveHydratedLocale('ar', true, 'fr')).toBe('ar');
    expect(resolveHydratedLocale('en', false, 'fr')).toBe('fr');
    expect(resolveHydratedLocale('en', false, 'invalid')).toBe('en');
    expect(resolveHydratedLocale('en', false, null)).toBe('en');

    const { PreferencesProvider, usePreferences } =
      await import('./preferences');
    function LocaleProbe() {
      return React.createElement('span', null, usePreferences().locale);
    }
    const markup = renderToStaticMarkup(
      React.createElement(PreferencesProvider, {
        initialLocale: 'en',
        hasValidLocaleCookie: false,
        children: React.createElement(LocaleProbe),
      }),
    );

    // localStorage is not available during this server render. The old locale
    // takes effect only after the client reads it during hydration.
    expect(markup).toContain('<span>en</span>');
  });

  it.each([
    ['http:', 'emora.locale=fr; Path=/; Max-Age=31536000; SameSite=Lax'],
    [
      'https:',
      'emora.locale=fr; Path=/; Max-Age=31536000; SameSite=Lax; Secure',
    ],
  ])(
    'persists locale to cookie and localStorage on %s',
    (protocol, expectedCookie) => {
      const setItem = vi.fn();
      const cookieWrites: string[] = [];
      const cookieDocument = {
        set cookie(value: string) {
          cookieWrites.push(value);
        },
      } as Pick<Document, 'cookie'>;

      persistLocalePreference(
        'fr',
        { setItem },
        cookieDocument,
        protocol === 'https:',
      );

      expect(cookieWrites).toEqual([expectedCookie]);
      expect(setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'fr');
      expect(LOCALE_COOKIE_NAME).toBe('emora.locale');
    },
  );

  it('preserves appearance and sidebar values and theme document attributes', () => {
    const values = new Map<string, string>();
    const documentElement = { dataset: {} as Record<string, string> };
    persistAppearanceAndSidebarPreferences(
      'dark',
      true,
      'dark',
      documentElement,
      { setItem: (key, value) => values.set(key, value) },
    );

    expect(values.get('emora.appearance')).toBe('dark');
    expect(values.get('emora.sidebar-collapsed')).toBe('true');
    expect(documentElement.dataset).toEqual({
      theme: 'dark',
      appearance: 'dark',
    });

    const localeDocumentElement = { lang: '', dir: '' };
    syncDocumentLocale('ar', localeDocumentElement);
    expect(localeDocumentElement).toEqual({ lang: 'ar', dir: 'rtl' });
  });
});
