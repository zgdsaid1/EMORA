'use client';

import Link from 'next/link';

import { usePreferences } from '../shell/preferences';

export default function ForgotPasswordPage() {
  const { t } = usePreferences();
  return (
    <main>
      <h1>{t('resetUnavailableHeading')}</h1>
      <p>{t('resetUnavailableDescription')}</p>
      <p>
        <Link href="/login">{t('returnToSignIn')}</Link>
      </p>
    </main>
  );
}
