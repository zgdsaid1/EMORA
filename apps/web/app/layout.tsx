import type { Metadata } from 'next';

import { ApplicationShell } from './shell/application-shell';
import { PreferencesProvider } from './shell/preferences';
import './globals.css';

export const metadata: Metadata = {
  title: 'EMORA | Research Instrument',
  description: 'Scientific instrument for computational, model-estimated emotional-state research.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body>
        <PreferencesProvider>
          <ApplicationShell>{children}</ApplicationShell>
        </PreferencesProvider>
      </body>
    </html>
  );
}
