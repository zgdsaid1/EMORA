'use client';

import { useCallback, useEffect, useState } from 'react';

import { handleUnauthorizedResponse } from './session-recovery';
import { usePreferences } from './shell/preferences';

import { SCIENTIFIC_DISCLOSURE_CODE } from '../server/transitions/disclosure';

/**
 * Slice 2 panel: the most recently persisted computational state for the
 * authorized profile. Displays model-output fields only — never internal
 * computation quantities or raw persisted structures. The scientific
 * disclosure is rendered persistently, exactly as the transition form does.
 */
interface LatestStateResponse {
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

type PanelState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly data: LatestStateResponse };

export function LatestStatePanel({
  projectId,
  profileId,
}: {
  projectId: string;
  profileId: string;
}) {
  const { t } = usePreferences();
  const [state, setState] = useState<PanelState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/profiles/${profileId}/states/latest`,
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
      if (response.status === 404) {
        setState({ kind: 'empty' });
        return;
      }
      if (!response.ok) {
        setState({ kind: 'error' });
        return;
      }
      const body = (await response.json()) as LatestStateResponse;
      setState({ kind: 'ready', data: body });
    } catch {
      setState({ kind: 'error' });
    }
  }, [projectId, profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <h2>{t('wsLatestHeading')}</h2>
      <button
        type="button"
        onClick={() => void load()}
        disabled={state.kind === 'loading'}
      >
        {state.kind === 'loading' ? t('wsReading') : t('wsRefreshState')}
      </button>

      {state.kind === 'empty' && <p>{t('wsLatestEmpty')}</p>}

      {state.kind === 'error' && <p role="alert">{t('wsLatestError')}</p>}

      {state.kind === 'ready' && (
        <div>
          <p>
            <strong>{t('wsEmotionVector')}</strong>
          </p>
          <ul>
            {EMOTION_LABELS.map((emotion) => (
              <li key={emotion}>
                {t(EMOTION_LABEL_KEYS[emotion])}:{' '}
                {state.data.emotionVector[emotion]?.toFixed(4)}
              </li>
            ))}
          </ul>
          <p>
            <strong>{t('wsDimensions')}</strong>
          </p>
          <ul>
            {DIMENSION_LABELS.map((dimension) => (
              <li key={dimension.key}>
                {t(dimension.labelKey)}:{' '}
                {state.data.dimensions[dimension.key].toFixed(4)}
              </li>
            ))}
          </ul>
          <p>
            <strong>{t('wsModelIdentity')}</strong>
          </p>
          <ul>
            <li>
              {t('name')}: {state.data.modelIdentity.name}
            </li>
            <li>
              {t('wsVersion')}: {state.data.modelIdentity.version}
            </li>
            <li>
              {t('wsProvider')}: {state.data.modelIdentity.providerIdentifier} (
              {state.data.modelIdentity.providerVersion})
            </li>
          </ul>
          <p>
            <strong>{t('wsParameterIdentity')}</strong>:{' '}
            {state.data.parameterIdentity}
          </p>
          <p>
            {t('wsComputedAt')} {state.data.timestamp}
          </p>
        </div>
      )}

      {/* Persistent, non-dismissible scientific disclosure. The visible text
          is the presentation translation keyed by the canonical disclosure
          code; the server constant remains the machine/API authority. */}
      <aside
        role="note"
        data-disclosure={SCIENTIFIC_DISCLOSURE_CODE}
        aria-label={t('disclosureLabel')}
      >
        <p>{t('disclosureText')}</p>
      </aside>
    </section>
  );
}
