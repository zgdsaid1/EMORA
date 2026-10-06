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
    <section className="workspace-section">
      <div className="workspace-section-heading">
        <h2>{t('wsLatestHeading')}</h2>
        <button
          type="button"
          className="text-button"
          onClick={() => void load()}
          disabled={state.kind === 'loading'}
        >
          {state.kind === 'loading' ? t('wsReading') : t('wsRefreshState')}
        </button>
      </div>

      {state.kind === 'empty' && (
        <p className="workspace-meta">{t('wsLatestEmpty')}</p>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="workspace-error">{t('wsLatestError')}</p>
      )}

      {state.kind === 'ready' && (
        <>
          <div className="workspace-readout">
            <h3 className="workspace-readout-heading">{t('wsEmotionVector')}</h3>
            {EMOTION_LABELS.map((emotion) => (
              <div key={emotion} className="workspace-readout-row">
                <span className="workspace-readout-label">
                  {t(EMOTION_LABEL_KEYS[emotion])}
                </span>
                <span className="workspace-readout-value">
                  {state.data.emotionVector[emotion]?.toFixed(4)}
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
                  {state.data.dimensions[dimension.key].toFixed(4)}
                </span>
              </div>
            ))}

            <h3 className="workspace-readout-heading">{t('wsModelIdentity')}</h3>
            <div className="workspace-readout-row">
              <span className="workspace-readout-label">{t('name')}</span>
              <span className="workspace-readout-value">
                {state.data.modelIdentity.name}
              </span>
            </div>
            <div className="workspace-readout-row">
              <span className="workspace-readout-label">{t('wsVersion')}</span>
              <span className="workspace-readout-value">
                {state.data.modelIdentity.version}
              </span>
            </div>
            <div className="workspace-readout-row">
              <span className="workspace-readout-label">{t('wsProvider')}</span>
              <span className="workspace-readout-value">
                {state.data.modelIdentity.providerIdentifier} (
                {state.data.modelIdentity.providerVersion})
              </span>
            </div>
            <div className="workspace-readout-row">
              <span className="workspace-readout-label">
                {t('wsParameterIdentity')}
              </span>
              <span className="workspace-readout-value">
                <code>{state.data.parameterIdentity}</code>
              </span>
            </div>
          </div>
          <p className="workspace-meta">
            {t('wsComputedAt')}{' '}
            <time dateTime={state.data.timestamp}>{state.data.timestamp}</time>
          </p>
        </>
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
