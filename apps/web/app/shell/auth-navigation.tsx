'use client';

import Link from 'next/link';

import { usePreferences } from './preferences';

export function LoginNavigation() {
  const { t } = usePreferences();
  return (
    <nav>
      <Link href="/register">{t('createAccount')}</Link>{' '}
      <Link href="/forgot-password">{t('forgotPassword')}</Link>
    </nav>
  );
}

export function RegisterNavigation() {
  const { t } = usePreferences();
  return <p><Link href="/login">{t('alreadyAccount')}</Link></p>;
}