'use client';

import { authClient } from '@emora/auth/client';

import { usePreferences } from './shell/preferences';

export function LogoutButton() {
  const { t } = usePreferences();

  async function logout() {
    await authClient.signOut();
    window.location.assign('/login');
  }

  return (
    <button type="button" onClick={logout}>
      {t('logout')}
    </button>
  );
}
