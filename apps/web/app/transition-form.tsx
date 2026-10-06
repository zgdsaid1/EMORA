'use client';

import { FormEvent, useState } from 'react';

import { handleUnauthorizedResponse } from './session-recovery';
import { usePreferences } from './shell/preferences';

import { SCIENTIFIC_DISCLOSURE_CODE } from '../server/transitions/disclosure';

interface TransitionResponse {
  readonly requestId: string;
  readonly duplicate: boolean;
  readonly projectId: string;
  readonly profileId: string;
  readonly eventId: string;
  readonly stateId: string;
  readonly timestamp: string;
  readonly emotionVector: Readonly<Record<string, number>>;
  readonly dimensions: {
    readonly valence: number;
    readonly arousal: number;
    readonly intensity: number;
  };
  readonly modelIdentity: {
    readonly modelVersionId: string;
    readonly name: string;
    readonly version: string;
    readonly providerIdentifier: string;
    readonly providerVersion: string;
  };
  readonly parameterIdentity: string;
  readonly initialized: boolean;
  readonly disclosure: string;
  readonly disclosureText: string;
}

const EMOTION_LABELS = [
  'love',
  'fear',
  'nostalgia',
  'jealousy',
  'trust',
  'anger',
  'joy',
] as const;

/** Presentation labels keyed by the canonical machine token. */
const EMOTION_LABEL_KEYS = {
  love: 'wsEmotionLove',
  fear: 'wsEmotionFear',
  nostalgia: 'wsEmotionNostalgia',
  jealousy: 'wsEmotionJealousy',
  trust: 'wsEmotionTrust',
  anger: 'wsEmotionAnger',
  joy: 'wsEmotionJoy',
} as const;

const DIMENSION_LABELS = [
  { key: 'valence', labelKey: 'wsDimValence' },
  { key: 'arousal', labelKey: 'wsDimArousal' },
  { key: 'intensity', labelKey: 'wsDimIntensity' },
] as const;

const EVENT_FIELDS = [
  { name: 'valence', labelKey: 'wsFieldValence', min: -1, max: 1 },
  { name: 'intensity', labelKey: 'wsFieldIntensity', min: 0, max: 1 },
  { name: 'relevance', labelKey: 'wsFieldRelevance', min: 0, max: 1 },
  { name: 'surprise', labelKey: 'wsFieldSurprise', min: 0, max: 1 },
  { name: 'uncertainty', labelKey: 'wsFieldUncertainty', min: 0, max: 1 },
] as const;

export function TransitionForm({
  projectId,
  profileId,
}: {
  projectId: string;
  profileId: string;
}) {
  const { t } = usePreferences();
  const [result, setResult] = useState<TransitionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const formData = new FormData(event.currentTarget);
      const payload: Record<string, unknown> = {};
      for (const field of EVENT_FIELDS) {
        payload[field.name] = Number(formData.get(field.name) ?? '');
      }
      const contextText = String(formData.get('context') ?? '').trim();
      if (contextText.length > 0) {
        try {
          payload.context = JSON.parse(contextText);
        } catch {
          setError(t('wsContextInvalid'));
          return;
        }
      }

      const response = await fetch(
        `/api/v1/projects/${projectId}/profiles/${profileId}/transitions`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            // A fresh key per user submission; duplicates are never sent here.
            'idempotency-key': crypto.randomUUID(),
          },
          body: JSON.stringify(payload),
        },
      );
      if (
        handleUnauthorizedResponse(
          response.status,
          `${window.location.pathname}${window.location.search}`,
          (url) => window.location.assign(url),
        )
      ) {
        return;
      }
      const body = (await response.json()) as
        TransitionResponse | { error?: { message?: string } };

      if (!response.ok) {
        setResult(null);
        setError(
          (body as { error?: { message?: string } }).error?.message ??
            t('wsTransitionFailed'),
        );
        return;
      }
      setResult(body as TransitionResponse);
    } catch {
      setError(t('wsTransitionFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="workspace-section">
      <div className="workspace-section-heading">
        <h2>{t('wsSubmitEvent')}</h2>
      </div>
      <form className="workspace-form" onSubmit={submit}>
        {EVENT_FIELDS.map((field) => (
          <label className="workspace-field" key={field.name}>
            <span className="workspace-field-label">{t(field.labelKey)}</span>
            <input
              name={field.name}
              type="number"
              step="0.01"
              min={field.min}
              max={field.max}
              defaultValue="0"
              required
            />
          </label>
        ))}
        <label className="workspace-field">
          <span className="workspace-field-label">{t('wsContextOptional')}</span>
          <textarea name="context" rows={3} />
        </label>
        <div className="workspace-actions">
          <button className="workspace-button" type="submit" disabled={pending}>
            {pending ? t('wsComputing') : t('wsRunTransition')}
          </button>
        </div>
      </form>

      {error && <p role="alert" className="workspace-error">{error}</p>}

      {result && (
        <div className="workspace-readout">
          <h3 className="workspace-readout-heading">{t('wsResultHeading')}</h3>
          {result.duplicate && (
            <p role="status" className="workspace-status">{t('wsDuplicate')}</p>
          )}
          <h3 className="workspace-readout-heading">{t('wsEmotionVector')}</h3>
          {EMOTION_LABELS.map((emotion) => (
            <div key={emotion} className="workspace-readout-row">
              <span className="workspace-readout-label">
                {t(EMOTION_LABEL_KEYS[emotion])}
              </span>
              <span className="workspace-readout-value">
                {result.emotionVector[emotion]?.toFixed(4)}
              </span>
            </div>
          ))}

          <h3 className="workspace-readout-heading">{t('wsDimensions')}</h3>
          {DIMENSION_LABELS.map((dimension) => (
            <div key={dimension.key} className="workspace-readout-row">
              <span className="workspace-readout-label">
                {t(dimension.labelKey)}
              </span>
              <span className="workspace-readout-value">
                {result.dimensions[dimension.key].toFixed(4)}
              </span>
            </div>
          ))}

          <h3 className="workspace-readout-heading">{t('wsModelIdentity')}</h3>
          <div className="workspace-readout-row">
            <span className="workspace-readout-label">{t('name')}</span>
            <span className="workspace-readout-value">
              {result.modelIdentity.name}
            </span>
          </div>
          <div className="workspace-readout-row">
            <span className="workspace-readout-label">{t('wsVersion')}</span>
            <span className="workspace-readout-value">
              {result.modelIdentity.version}
            </span>
          </div>
          <div className="workspace-readout-row">
            <span className="workspace-readout-label">{t('wsProvider')}</span>
            <span className="workspace-readout-value">
              {result.modelIdentity.providerIdentifier} (
              {result.modelIdentity.providerVersion})
            </span>
          </div>
          <div className="workspace-readout-row">
            <span className="workspace-readout-label">
              {t('wsParameterIdentity')}
            </span>
            <span className="workspace-readout-value">
              <code>{result.parameterIdentity}</code>
            </span>
          </div>
          <p className="workspace-meta">
            {t('wsEvent')} {result.eventId} · {t('wsState')} {result.stateId} ·{' '}
            {result.timestamp}
          </p>
        </div>
      )}

      {/* Persistent, non-dismissible scientific disclosure. The visible text
          is the presentation translation keyed by the canonical disclosure
          code; the server constant remains the machine/API authority. */}
      <aside
        role="note"
        className="scientific-disclosure"
        data-disclosure={SCIENTIFIC_DISCLOSURE_CODE}
        aria-label={t('disclosureLabel')}
      >
        <p>{t('disclosureText')}</p>
      </aside>
    </section>
  );
}
