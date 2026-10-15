'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';

import { translate, type Locale, type MessageKey } from './messages';

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
  locale: 'emora.locale',
  sidebar: 'emora.sidebar-collapsed',
} as const;

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'fr' || value === 'ar';
}

export function resolveStoredLocale(value: string | null): Locale {
  return isLocale(value) ? value : 'en';
}

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

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearanceMode>('system');
  const [locale, setLocaleState] = useState<Locale>('en');
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useHydrationLayoutEffect(() => {
    const storedAppearance = localStorage.getItem(STORAGE_KEYS.appearance);
    const storedLocale = resolveStoredLocale(
      localStorage.getItem(STORAGE_KEYS.locale),
    );
    setAppearanceState(isAppearance(storedAppearance) ? storedAppearance : 'system');
    setLocaleState(storedLocale);
    syncDocumentLocale(storedLocale, document.documentElement);
    setSidebarCollapsedState(
      localStorage.getItem(STORAGE_KEYS.sidebar) === 'true',
    );
    setHydrated(true);
  }, []);

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
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.appearance = appearance;
      syncDocumentLocale(locale, document.documentElement);
      localStorage.setItem(STORAGE_KEYS.appearance, appearance);
      localStorage.setItem(STORAGE_KEYS.locale, locale);
      localStorage.setItem(STORAGE_KEYS.sidebar, String(sidebarCollapsed));
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
