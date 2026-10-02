'use client';

import type { NavigationKey } from './navigation-messages';
import { navigationLabel } from './navigation-messages';
import { ScientificBreadcrumbs, Status } from './primitives';
import { usePreferences } from './preferences';

export function ModulePlaceholder({
  itemKey,
  sectionKey,
}: {
  itemKey: NavigationKey;
  sectionKey: NavigationKey;
}) {
  const { locale, t } = usePreferences();
  const title = navigationLabel(locale, itemKey);
  const sectionTitle = navigationLabel(locale, sectionKey);

  return (
    <main className="module-placeholder">
      <ScientificBreadcrumbs
        items={[
          { label: 'EMORA', href: '/' },
          { label: sectionTitle },
          { label: title },
        ]}
      />
      <header className="page-heading">
        <span className="page-kicker">{sectionTitle.toLocaleUpperCase(locale)}</span>
        <h1>{title}</h1>
        <p>{t('placeholderPurpose')}</p>
      </header>
      <section className="placeholder-ledger">
        <h2>{t('moduleStatus')}</h2>
        <Status state="unknown">{t('notImplemented')}</Status>
      </section>
      <section className="placeholder-ledger">
        <h2>{t('modulePurpose')}</h2>
        <p>{t('reservedNote')}</p>
      </section>
      <section className="placeholder-ledger">
        <h2>{t('reservedFunctionality')}</h2>
        <p>{t('notImplemented')}</p>
      </section>
    </main>
  );
}