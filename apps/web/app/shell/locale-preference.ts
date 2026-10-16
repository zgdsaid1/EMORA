import type { Locale } from './messages';

export const LOCALE_COOKIE_NAME = 'emora.locale';
export const LOCALE_STORAGE_KEY = 'emora.locale';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'fr' || value === 'ar';
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}

/**
 * localStorage is unavailable to the server. A valid cookie therefore wins;
 * when one is absent, migrate a valid legacy localStorage locale after
 * hydration. That migration cannot affect the initial server-rendered HTML.
 */
export function resolveHydratedLocale(
  serverLocale: Locale,
  hasLocaleCookie: boolean,
  legacyLocale: unknown,
): Locale {
  return hasLocaleCookie ? serverLocale : resolveLocale(legacyLocale);
}

export function persistLocalePreference(
  locale: Locale,
  storage: Pick<Storage, 'setItem'>,
  cookieDocument: Pick<Document, 'cookie'>,
  isSecure: boolean,
): void {
  const secureAttribute = isSecure ? '; Secure' : '';
  cookieDocument.cookie =
    `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax` +
    secureAttribute;
  storage.setItem(LOCALE_STORAGE_KEY, locale);
}
