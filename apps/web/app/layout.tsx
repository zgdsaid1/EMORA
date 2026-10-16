import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import * as React from 'react';

import { ApplicationShell } from './shell/application-shell';
import { PreferencesProvider } from './shell/preferences';
import {
  isLocale,
  LOCALE_COOKIE_NAME,
  resolveLocale,
} from './shell/locale-preference';
import './globals.css';

export const metadata: Metadata = {
  title: 'EMORA | Research Instrument',
  description:
    'Scientific instrument for computational, model-estimated emotional-state research.',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const localeCookie = (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
  const locale = resolveLocale(localeCookie);

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      suppressHydrationWarning
    >
      <body>
        <PreferencesProvider
          initialLocale={locale}
          hasValidLocaleCookie={isLocale(localeCookie)}
        >
          <ApplicationShell>{children}</ApplicationShell>
        </PreferencesProvider>
      </body>
    </html>
  );
}
