'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { usePreferences } from './preferences';

export type DataOrigin =
  | 'observed'
  | 'derived'
  | 'estimated'
  | 'simulated'
  | 'unknown'
  | 'not-evaluable';

export type ValueState =
  | 'value'
  | 'no-data'
  | 'unknown'
  | 'not-evaluable'
  | 'error'
  | 'unavailable'
  | 'stale'
  | 'loading';

function originLabel(origin: DataOrigin, t: ReturnType<typeof usePreferences>['t']) {
  return origin === 'not-evaluable' ? t('notEvaluable') : t(origin);
}

export function Status({
  state,
  children,
}: {
  state: 'positive' | 'info' | 'advisory' | 'warning' | 'error' | 'critical' | 'unknown';
  children?: ReactNode;
}) {
  const { t } = usePreferences();
  return (
    <span className={`scientific-status status-${state}`}>
      <span aria-hidden="true" className="status-symbol" />
      {children ?? t(state)}
    </span>
  );
}

export function ScientificValue({
  value,
  state = 'value',
  unit,
  precision,
  origin,
  label,
}: {
  value?: number | string;
  state?: ValueState;
  unit?: string;
  precision?: number;
  origin?: DataOrigin;
  label?: string;
}) {
  const { t } = usePreferences();
  const stateLabel = {
    'no-data': t('noData'),
    unknown: t('unknown'),
    'not-evaluable': t('notEvaluable'),
    error: t('error'),
    unavailable: t('unavailable'),
    stale: t('stale'),
    loading: '…',
  } as const;
  const formatted =
    state === 'value' && typeof value === 'number' && precision !== undefined
      ? value.toFixed(precision)
      : state === 'value'
        ? String(value ?? t('unknown'))
        : stateLabel[state];

  return (
    <span className={`scientific-value value-${state}`} aria-label={label}>
      <span className="scientific-number" dir="ltr">{formatted}</span>
      {unit && state === 'value' && <span className="scientific-unit">{unit}</span>}
      {origin && <span className="origin-label">{originLabel(origin, t)}</span>}
    </span>
  );
}

export function Metric({
  label,
  value,
  unit,
  detail,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
}) {
  return (
    <div className="metric-row">
      <span className="metric-label">{label}</span>
      <span className="metric-result">{value}{unit && <small>{unit}</small>}</span>
      {detail && <span className="metric-detail">{detail}</span>}
    </div>
  );
}

export function Timestamp({
  value,
  mode = 'absolute',
  timeZone = 'UTC',
}: {
  value: string | Date;
  mode?: 'absolute' | 'relative';
  timeZone?: 'UTC' | 'local';
}) {
  const { locale, t } = usePreferences();
  const [displayMode, setDisplayMode] = useState(mode);
  const date = value instanceof Date ? value : new Date(value);
  const valid = Number.isFinite(date.getTime());
  const iso = valid ? date.toISOString() : undefined;
  const zone = timeZone === 'UTC' ? 'UTC' : undefined;
  let text = t('unknown');

  if (valid && displayMode === 'absolute') {
    text = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: zone,
      hourCycle: 'h23',
    }).format(date);
  } else if (valid) {
    const difference = date.getTime() - Date.now();
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 31_536_000_000],
      ['month', 2_592_000_000],
      ['day', 86_400_000],
      ['hour', 3_600_000],
      ['minute', 60_000],
      ['second', 1_000],
    ];
    const [unit, divisor] = units.find(([, size]) => Math.abs(difference) >= size) ?? units[5];
    text = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      Math.round(difference / divisor),
      unit,
    );
  }

  return (
    <span className="timestamp-control">
      <time dateTime={iso} title={`${timeZone === 'UTC' ? t('utc') : t('localTime')} · ${iso ?? t('unknown')}`}>
        {text}
      </time>
      <button
        aria-label={displayMode === 'absolute' ? t('relativeTime') : t('absoluteTime')}
        className="text-button"
        onClick={() => setDisplayMode(displayMode === 'absolute' ? 'relative' : 'absolute')}
        type="button"
      >
        {timeZone === 'UTC' ? t('utc') : t('localTime')}
      </button>
    </span>
  );
}

export function TimeRange({
  start,
  end,
  live = false,
}: {
  start?: string | Date;
  end?: string | Date;
  live?: boolean;
}) {
  const { t } = usePreferences();
  const startDate = start ? new Date(start) : undefined;
  const endDate = end ? new Date(end) : undefined;
  const duration =
    startDate && endDate && Number.isFinite(startDate.getTime()) && Number.isFinite(endDate.getTime())
      ? Math.max(0, endDate.getTime() - startDate.getTime())
      : undefined;

  return (
    <div className="time-range" data-mode={live ? 'live' : 'historical'}>
      <span className="technical-label">{live ? t('live') : t('historical')}</span>
      <span><Timestamp value={start ?? ''} /> <span aria-hidden="true">→</span> <Timestamp value={end ?? ''} /></span>
      <span className="time-duration" dir="ltr">
        {duration === undefined ? t('unknown') : `${(duration / 1000).toFixed(1)} s`}
      </span>
    </div>
  );
}

export function ModelVersion({ name, version, id }: { name: string; version: string; id?: string }) {
  return (
    <span className="model-version" title={id}>
      <span>{name}</span><code>{version}</code>
    </span>
  );
}

export function Provenance({ source, origin }: { source: string; origin: DataOrigin }) {
  const { t } = usePreferences();
  return <span className="provenance"><span>{originLabel(origin, t)}</span><span>{source}</span></span>;
}

export function Confidence({ value, state = 'unknown' }: { value?: number; state?: ValueState }) {
  const { t } = usePreferences();
  return (
    <Metric
      label={t('confidence')}
      value={value === undefined ? <ScientificValue state={state} /> : <ScientificValue value={value} precision={3} />}
      unit={value === undefined ? undefined : '0–1'}
    />
  );
}

export function DataQuality({ state, detail }: { state: ValueState; detail?: string }) {
  const { t } = usePreferences();
  const labels: Record<ValueState, string> = {
    value: t('qualityRecorded'),
    'no-data': t('noData'),
    unknown: t('unknown'),
    'not-evaluable': t('notEvaluable'),
    error: t('error'),
    unavailable: t('unavailable'),
    stale: t('stale'),
    loading: t('unknown'),
  };
  const label = labels[state];
  return <Status state={state === 'value' ? 'info' : state === 'error' ? 'error' : 'warning'}>{detail ?? label}</Status>;
}

export function EvidenceBadge({ code, source }: { code: string; source?: string }) {
  return <span className="evidence-badge"><code>{code}</code>{source && <span>{source}</span>}</span>;
}

function StateMessage({
  kind,
  title,
  children,
}: {
  kind: 'empty' | 'not-evaluable' | 'unavailable' | 'loading' | 'error';
  title: string;
  children?: ReactNode;
}) {
  return (
    <section aria-live={kind === 'loading' ? 'polite' : 'off'} className={`state-message state-${kind}`}>
      <span className="state-index" aria-hidden="true">{kind === 'error' ? '!' : '—'}</span>
      <div><h2>{title}</h2>{children && <p>{children}</p>}</div>
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <StateMessage kind="empty" title={title}>{children}</StateMessage>;
}

export function NotEvaluableState({ title, children }: { title: string; children?: ReactNode }) {
  return <StateMessage kind="not-evaluable" title={title}>{children}</StateMessage>;
}

export function UnavailableState({ title, children }: { title: string; children?: ReactNode }) {
  return <StateMessage kind="unavailable" title={title}>{children}</StateMessage>;
}

export function LoadingState({ title }: { title: string }) {
  return <StateMessage kind="loading" title={title} />;
}

export function ErrorState({ title, children }: { title: string; children?: ReactNode }) {
  return <StateMessage kind="error" title={title}>{children}</StateMessage>;
}

export function ScientificBreadcrumbs({
  items,
}: {
  items: readonly { readonly label: string; readonly href?: string }[];
}) {
  const { t } = usePreferences();
  return (
    <nav aria-label={t('breadcrumb')} className="scientific-breadcrumbs">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.href && index < items.length - 1 ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current={index === items.length - 1 ? 'page' : undefined}>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export type AlertSeverity = 'info' | 'advisory' | 'warning' | 'error' | 'critical';

export function ScientificAlert({
  severity,
  title,
  timestamp,
  source,
  eventId,
  module,
  onAcknowledge,
  children,
}: {
  severity: AlertSeverity;
  title: string;
  timestamp?: string;
  source?: string;
  eventId?: string;
  module?: string;
  onAcknowledge?: () => void;
  children?: ReactNode;
}) {
  const { t } = usePreferences();
  return (
    <section className={`scientific-alert alert-${severity}`} aria-label={title}>
      <Status state={severity === 'info' ? 'info' : severity}>{t(severity)}</Status>
      <div className="alert-content">
        <h2>{title}</h2>
        {children && <div>{children}</div>}
        <div className="alert-metadata">
          {timestamp && <Timestamp value={timestamp} />}
          {source && <span>{source}</span>}
          {eventId && <code>{eventId}</code>}
          {module && <span>{module}</span>}
        </div>
      </div>
      {onAcknowledge && <button className="text-button" onClick={onAcknowledge} type="button">{t('acknowledge')}</button>}
    </section>
  );
}