'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import * as React from 'react';

import { translate, type Locale, type MessageKey } from './messages';
import {
  LOCALE_STORAGE_KEY,
  persistLocalePreference,
  resolveHydratedLocale,
} from './locale-preference';

export type AppearanceMode = 'light' | 'dark' | 'system';

interface Preferences {
  readonly appearance: AppearanceMode;
  readonly locale: Locale;
  readonly sidebarCollapsed: boolean;
  setAppearance: (value: AppearanceMode) => void;
  setLocale: (value: Locale) => void;
  setSidebarCollapsed: (value: boolean) => void;
  t: (key: MessageKey) => string;
}

const PreferencesContext = createContext<Preferences | null>(null);

const STORAGE_KEYS = {
  appearance: 'emora.appearance',
  sidebar: 'emora.sidebar-collapsed',
} as const;

export function syncDocumentLocale(
  locale: Locale,
  documentElement: Pick<HTMLElement, 'lang' | 'dir'>,
): void {
  documentElement.lang = locale;
  documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

const useHydrationLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

function isAppearance(value: string | null): value is AppearanceMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function persistAppearanceAndSidebarPreferences(
  appearance: AppearanceMode,
  sidebarCollapsed: boolean,
  resolvedTheme: 'light' | 'dark',
  documentElement: Pick<HTMLElement, 'dataset'>,
  storage: Pick<Storage, 'setItem'>,
): void {
  documentElement.dataset.theme = resolvedTheme;
  documentElement.dataset.appearance = appearance;
  storage.setItem(STORAGE_KEYS.appearance, appearance);
  storage.setItem(STORAGE_KEYS.sidebar, String(sidebarCollapsed));
}

export function PreferencesProvider({
  children,
  initialLocale,
  hasValidLocaleCookie,
}: {
  children: ReactNode;
  initialLocale: Locale;
  hasValidLocaleCookie: boolean;
}) {
  const [appearance, setAppearanceState] = useState<AppearanceMode>('system');
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useHydrationLayoutEffect(() => {
    const storedAppearance = localStorage.getItem(STORAGE_KEYS.appearance);
    setAppearanceState(
      isAppearance(storedAppearance) ? storedAppearance : 'system',
    );
    // Older clients may have a locale only in localStorage. The server cannot
    // read it, so migrate it after hydration only when no valid locale cookie
    // was present. This migration cannot affect the initial server response.
    if (!hasValidLocaleCookie) {
      const legacyLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
      setLocaleState(resolveHydratedLocale(initialLocale, false, legacyLocale));
    }
    setSidebarCollapsedState(
      localStorage.getItem(STORAGE_KEYS.sidebar) === 'true',
    );
    setHydrated(true);
  }, [hasValidLocaleCookie, initialLocale]);

  useHydrationLayoutEffect(() => {
    if (!hydrated) return;

    syncDocumentLocale(locale, document.documentElement);
    persistLocalePreference(
      locale,
      localStorage,
      document,
      window.location.protocol === 'https:',
    );
  }, [hydrated, locale]);

  useHydrationLayoutEffect(() => {
    if (!hydrated) return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolved =
        appearance === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
          : appearance;
      persistAppearanceAndSidebarPreferences(
        appearance,
        sidebarCollapsed,
        resolved,
        document.documentElement,
        localStorage,
      );
    };

    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [appearance, hydrated, locale, sidebarCollapsed]);

  const value: Preferences = {
    appearance,
    locale,
    sidebarCollapsed,
    setAppearance: setAppearanceState,
    setLocale: setLocaleState,
    setSidebarCollapsed: setSidebarCollapsedState,
    t: (key) => translate(locale, key),
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): Preferences {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error('usePreferences must be used within PreferencesProvider.');
  }
  return value;
}
