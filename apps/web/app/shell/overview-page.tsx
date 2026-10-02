'use client';

import Link from 'next/link';

import { SCIENTIFIC_DISCLOSURE_CODE, SCIENTIFIC_DISCLOSURE_TEXT } from '../../server/transitions/disclosure';
import { navigationCatalog, allNavigationItems } from './catalog';
import { ScientificBreadcrumbs } from './primitives';
import { usePreferences } from './preferences';

export function OverviewPage() {
  const { t } = usePreferences();
  const implementedRoutes = new Set(
    allNavigationItems.filter((item) => item.available).map((item) => item.href),
  );
  const reservedItems = allNavigationItems.filter((item) => !item.available).length;

  return (
    <main className="overview-page">
      <ScientificBreadcrumbs items={[{ label: 'EMORA', href: '/' }, { label: t('overview') }]} />
      <header className="page-heading">
        <span className="page-kicker">{t('overviewKicker')}</span>
        <h1>{t('overviewTitle')}</h1>
        <p>{t('overviewDescription')}</p>
      </header>

      <section aria-label={t('foundationStatus')} className="foundation-readout">
        <div>
          <span className="technical-label">{t('navigationSections')}</span>
          <span className="readout-value">{navigationCatalog.length.toString().padStart(2, '0')}</span>
          <span className="technical-label">{t('instrument')}</span>
        </div>
        <div>
          <span className="technical-label">{t('availableRoutes')}</span>
          <span className="readout-value">{implementedRoutes.size.toString().padStart(2, '0')}</span>
          <span className="technical-label">{t('implemented')}</span>
        </div>
        <div>
          <span className="technical-label">{t('plannedModules')}</span>
          <span className="readout-value">{reservedItems.toString().padStart(2, '0')}</span>
          <span className="technical-label">{t('planned')}</span>
        </div>
      </section>

      <div className="overview-grid">
        <section className="overview-entry">
          <h2>{t('workspaceEntry')}</h2>
          <ul>
            <li>
              <Link href="/app">
                <span>{t('openWorkspace')}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
            <li>
              <Link href="/login">
                <span>{t('signInToWorkspace')}</span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          </ul>
        </section>
        <section className="overview-ledger">
          <h2>{t('instrument')}</h2>
          <p>{t('reservedNote')}</p>
          <p>
            {navigationCatalog.length.toString().padStart(2, '0')} / {navigationCatalog.length.toString().padStart(2, '0')} {t('systemStatus')}
          </p>
        </section>
      </div>

      <aside
        aria-label={t('disclosureLabel')}
        className="scientific-disclosure"
        data-disclosure={SCIENTIFIC_DISCLOSURE_CODE}
        role="note"
      >
        <strong>{t('disclosureHeading')}</strong>
        <p>{SCIENTIFIC_DISCLOSURE_TEXT}</p>
      </aside>
    </main>
  );
}