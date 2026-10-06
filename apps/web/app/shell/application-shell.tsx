'use client';

import {
  Activity,
  BarChart2,
  BookOpen,
  Briefcase,
  ChevronDown,
  Clipboard,
  Command,
  Cpu,
  Database,
  FileText,
  FlaskConical,
  Gauge,
  Globe,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shapes,
  Sliders,
  SunMoon,
  Telescope,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { allNavigationItems, navigationCatalog } from './catalog';
import { navigationLabel } from './navigation-messages';
import { usePreferences } from './preferences';
import type { Locale } from './messages';

interface ResearchContext {
  readonly project?: { readonly name: string; readonly id: string };
  readonly profile?: { readonly name: string; readonly id: string };
}

const ContextUpdate = createContext<(context: ResearchContext) => void>(() => {});

export function ContextReporter({
  project,
  profile,
}: {
  project?: ResearchContext['project'];
  profile?: ResearchContext['profile'];
}) {
  const update = useContext(ContextUpdate);

  useEffect(() => {
    update({ project, profile });
    return () => update({});
  }, [profile, project, update]);

  return null;
}

const sectionIcons: Record<string, LucideIcon> = {
  observatory: Telescope,
  workspace: Briefcase,
  state: Activity,
  visualization: Shapes,
  analytics: BarChart2,
  ml: Cpu,
  memory: BookOpen,
  knowledge: Database,
  ai: Workflow,
  assessment: Clipboard,
  collaboration: Users,
  data: Database,
  research: FlaskConical,
  instrumentation: Gauge,
  visualLab: Shapes,
  reports: FileText,
  system: Settings,
  settings: Sliders,
};

function isAuthRoute(pathname: string): boolean {
  return [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ].includes(pathname);
}

function LocaleControl() {
  const { locale, setLocale, t } = usePreferences();

  return (
    <label className="shell-control" title={`${t('language')}: ${locale.toUpperCase()}`}>
      <Globe aria-hidden="true" size={16} strokeWidth={1.7} />
      <span className="sr-only">{t('language')}</span>
      <select
        aria-label={t('language')}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        <option value="en">EN</option>
        <option value="fr">FR</option>
        <option value="ar">AR</option>
      </select>
    </label>
  );
}

function AppearanceControl() {
  const { appearance, setAppearance, t } = usePreferences();
  // Same three modes and persistence as before; one icon cycles through them.
  const order = ['light', 'dark', 'system'] as const;
  const next = order[(order.indexOf(appearance) + 1) % order.length];
  const label = `${t('appearance')}: ${t(appearance)}`;

  return (
    <div className="appearance-control">
      <button
        aria-label={label}
        className="icon-button"
        onClick={() => setAppearance(next)}
        title={`${label} → ${t(next)}`}
        type="button"
      >
        <SunMoon aria-hidden="true" size={16} strokeWidth={1.7} />
      </button>
    </div>
  );
}

function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { locale, t } = usePreferences();
  const [query, setQuery] = useState('');
  const commands = useMemo(
    () =>
      allNavigationItems.map((item) => ({
        ...item,
        label: navigationLabel(locale, item.key),
      })),
    [locale],
  );
  const filtered = commands.filter((item) =>
    item.label.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)),
  );

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="command-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-label={t('commandSearch')}
        aria-modal="true"
        className="command-dialog"
        role="dialog"
      >
        <div className="command-input-row">
          <Search aria-hidden="true" size={17} />
          <input
            autoFocus
            aria-label={t('commandSearch')}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('commandPlaceholder')}
            value={query}
          />
          <button className="icon-button" onClick={onClose} type="button" aria-label={t('close')}>
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <ul className="command-results">
          {filtered.map((item) => (
            <li key={`${item.href}-${item.key}`}>
              <Link href={item.href} onClick={onClose}>
                <span>{item.label}</span>
                <span className="command-result-status">
                  {t(item.available ? 'implemented' : 'planned')}
                  <span aria-hidden="true">↵</span>
                </span>
              </Link>
            </li>
          ))}
          {filtered.length === 0 && <li className="command-empty">{t('noResults')}</li>}
        </ul>
      </section>
    </div>
  );
}

function ContextValue({
  label,
  value,
  code,
}: {
  label: string;
  value: string;
  code?: string;
}) {
  return (
    <div className="context-value">
      <span className="technical-label">{label}</span>
      <span className="context-value-main" title={code}>
        {value}
      </span>
    </div>
  );
}

function GlobalContextBar({ context }: { context: ResearchContext }) {
  const { t } = usePreferences();
  const [timestamp, setTimestamp] = useState<string>();

  useEffect(() => setTimestamp(new Date().toISOString()), []);

  return (
    <section aria-label={t('context')} className="context-bar">
      <div className="context-grid">
        <ContextValue
          label={t('project')}
          value={context.project?.name ?? t('notSelected')}
          code={context.project?.id}
        />
        <ContextValue
          label={t('profile')}
          value={context.profile?.name ?? t('notSelected')}
          code={context.profile?.id}
        />
        <ContextValue label={t('experiment')} value={t('unknown')} />
        <ContextValue label={t('session')} value={t('unknown')} />
        <ContextValue label={t('modelVersion')} value={t('unknown')} />
        <ContextValue label={t('systemStatus')} value={t('unknown')} />
      </div>
      <span className="context-stamp">
        {timestamp ? <time dateTime={timestamp}>{timestamp.slice(0, 16)} UTC</time> : t('unknown')}
      </span>
    </section>
  );
}

function Sidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const {
    locale,
    sidebarCollapsed,
    setSidebarCollapsed,
    t,
  } = usePreferences();
  const isCollapsed = sidebarCollapsed && !mobileOpen;

  return (
    <>
      {mobileOpen && (
        <button
          aria-label={t('closeNavigation')}
          className="mobile-sidebar-scrim"
          onClick={onMobileClose}
          type="button"
        />
      )}
      <aside
        aria-label={t('openNavigation')}
        className={`app-sidebar${isCollapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-mobile-open' : ''}`}
      >
        <div className="sidebar-heading">
          <Link
            aria-label={`EMORA — ${t('overview')}`}
            className="brand-lockup"
            href="/"
            onClick={onMobileClose}
          >
            <span aria-hidden="true" className="brand-mark">Σ</span>
            {!isCollapsed && (
              <span className="brand-copy">
                <strong>EMORA</strong>
                <small>{t('instrument')}</small>
              </span>
            )}
          </Link>
          <button
            aria-label={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            className="icon-button sidebar-collapse"
            onClick={() => setSidebarCollapsed(!isCollapsed)}
            title={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            type="button"
          >
            {isCollapsed ? (
              <PanelLeftOpen aria-hidden="true" size={17} />
            ) : (
              <PanelLeftClose aria-hidden="true" size={17} />
            )}
          </button>
        </div>

        <nav aria-label={t('openNavigation')} className="sidebar-navigation">
          {navigationCatalog.map((section) => {
            const Icon = sectionIcons[section.icon];
            const sectionName = navigationLabel(locale, section.key);
            if (isCollapsed) {
              const destination = section.items[0];
              return (
                <Link
                  aria-label={sectionName}
                  aria-current={destination.href === pathname ? 'page' : undefined}
                  className="collapsed-nav-item"
                  href={destination.href}
                  key={section.key}
                  onClick={onMobileClose}
                  title={sectionName}
                >
                  <Icon aria-hidden="true" size={18} strokeWidth={1.6} />
                </Link>
              );
            }
            return (
              <details className="nav-section" key={section.key} open>
                <summary>
                  <Icon aria-hidden="true" size={16} strokeWidth={1.7} />
                  <span>{sectionName}</span>
                  <ChevronDown aria-hidden="true" className="section-chevron" size={14} />
                </summary>
                <ul>
                  {section.items.map((item) => (
                    <li key={`${item.href}-${item.key}`}>
                      <Link
                        aria-current={item.href === pathname ? 'page' : undefined}
                        className={item.href === pathname ? 'is-current' : undefined}
                        href={item.href}
                        onClick={onMobileClose}
                      >
                        <span className={`availability-mark${item.available ? ' is-available' : ''}`} aria-hidden="true" />
                        <span>{navigationLabel(locale, item.key)}</span>
                        <span className="sr-only">{t(item.available ? 'implemented' : 'planned')}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </nav>
        {!isCollapsed && (
          <div className="sidebar-footer">
            <span className="status-led" aria-hidden="true" />
            <span>{t('systemStatus')}: {t('unknown')}</span>
          </div>
        )}
      </aside>
    </>
  );
}

export function ApplicationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = usePreferences();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [context, setContext] = useState<ResearchContext>({});
  const authPage = isAuthRoute(pathname);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const closeCommand = () => setCommandOpen(false);
  const currentItem = allNavigationItems.find((item) => item.href === pathname);
  const { locale } = usePreferences();

  if (authPage) {
    return (
      <div className="auth-frame">
        <header className="auth-frame-header">
          <Link className="auth-brand" href="/">
            <span aria-hidden="true" className="brand-mark">Σ</span>
            <span>EMORA</span>
          </Link>
          <div className="shell-toolbar">
            <AppearanceControl />
            <LocaleControl />
          </div>
        </header>
          <div className="auth-frame-content">{children}</div>
        <CommandPalette open={commandOpen} onClose={closeCommand} />
      </div>
    );
  }

  return (
    <ContextUpdate.Provider value={setContext}>
      <div className={`application-shell${mobileOpen ? ' mobile-menu-open' : ''}`}>
        <a className="skip-link" href="#workspace-main">{t('skipToContent')}</a>
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className="shell-main-column">
          <header className="global-header">
            <button
              aria-label={mobileOpen ? t('closeNavigation') : t('openNavigation')}
              className="icon-button mobile-menu-button"
              onClick={() => setMobileOpen((open) => !open)}
              type="button"
            >
              {mobileOpen ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
            </button>
            <div className="header-location">
              <span className="header-kicker">{currentItem ? navigationLabel(locale, currentItem.key) : t('overview')}</span>
              <span className="header-path">EMORA / {pathname === '/' ? 'OBSERVATORY' : pathname.slice(1).toUpperCase()}</span>
            </div>
            <div className="shell-toolbar">
              <button className="command-trigger" onClick={() => setCommandOpen(true)} type="button">
                <Search aria-hidden="true" size={15} />
                <span>{t('commandSearch')}</span>
                <kbd><Command aria-label={t('commandKey')} size={11} /> K</kbd>
              </button>
              <AppearanceControl />
              <LocaleControl />
            </div>
          </header>
          <GlobalContextBar context={context} />
          <div className="workspace-main" id="workspace-main" tabIndex={-1}>
            <div className="workspace-content">{children}</div>
          </div>
        </div>
        <CommandPalette open={commandOpen} onClose={closeCommand} />
      </div>
    </ContextUpdate.Provider>
  );
}

export function ShellProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}