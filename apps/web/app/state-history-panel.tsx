'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  invalidateRequestSequence,
  runLatestRequest,
} from './latest-state-request';
import { handleUnauthorizedResponse } from './session-recovery';
import { messages } from './shell/messages';
import { usePreferences } from './shell/preferences';

import { SCIENTIFIC_DISCLOSURE_CODE } from '../server/transitions/disclosure';

interface StateHistoryItem {
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
}

interface StateHistoryResponse {
  readonly requestId: string;
  readonly disclosure: typeof SCIENTIFIC_DISCLOSURE_CODE;
  readonly disclosureText: typeof messages.en.disclosureText;
  readonly states: readonly StateHistoryItem[];
}

interface InFlightStateHistoryRequest {
  readonly key: string;
  readonly promise: Promise<HistoryReadResult>;
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
  | { readonly kind: 'empty'; readonly data: StateHistoryResponse }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly data: StateHistoryResponse };

type HistoryReadResult =
  | { readonly kind: 'http-error'; readonly status: number }
  | { readonly kind: 'invalid-response' }
  | { readonly kind: 'ready'; readonly data: StateHistoryResponse };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStateHistoryItem(value: unknown): value is StateHistoryItem {
  if (!isRecord(value)) return false;

  const emotionVector = value.emotionVector;
  const dimensions = value.dimensions;
  const modelIdentity = value.modelIdentity;
  if (
    !isRecord(emotionVector) ||
    !isRecord(dimensions) ||
    !isRecord(modelIdentity)
  ) {
    return false;
  }

  if (
    !isNonEmptyString(value.stateId) ||
    !isNonEmptyString(value.timestamp) ||
    !Number.isFinite(Date.parse(value.timestamp)) ||
    !isNonEmptyString(value.parameterIdentity) ||
    typeof value.initialized !== 'boolean'
  ) {
    return false;
  }

  if (
    !EMOTION_LABELS.every((emotion) => isFiniteNumber(emotionVector[emotion]))
  ) {
    return false;
  }

  if (
    !isFiniteNumber(dimensions.valence) ||
    !isFiniteNumber(dimensions.arousal) ||
    !isFiniteNumber(dimensions.intensity)
  ) {
    return false;
  }

  return [
    modelIdentity.modelVersionId,
    modelIdentity.name,
    modelIdentity.version,
    modelIdentity.providerIdentifier,
    modelIdentity.providerVersion,
  ].every(isNonEmptyString);
}

function isStateHistoryResponse(value: unknown): value is StateHistoryResponse {
  return (
    isRecord(value) &&
    isNonEmptyString(value.requestId) &&
    value.disclosure === SCIENTIFIC_DISCLOSURE_CODE &&
    value.disclosureText === messages.en.disclosureText &&
    Array.isArray(value.states) &&
    value.states.length <= 10 &&
    value.states.every(isStateHistoryItem)
  );
}

export function StateHistoryPanel({
  projectId,
  profileId,
  refreshKey = 0,
}: {
  projectId: string;
  profileId: string;
  refreshKey?: number;
}) {
  const { t } = usePreferences();
  const [state, setState] = useState<PanelState>({ kind: 'loading' });
  const requestSequence = useRef(0);
  const inFlightRequest = useRef<InFlightStateHistoryRequest | null>(null);

  const load = useCallback(() => {
    setState({ kind: 'loading' });
    const requestKey = JSON.stringify([projectId, profileId, refreshKey]);
    let historyRequest: Promise<HistoryReadResult>;
    const currentRequest = inFlightRequest.current;

    if (currentRequest?.key === requestKey) {
      historyRequest = currentRequest.promise;
    } else {
      historyRequest = (async () => {
        const response = await fetch(
          `/api/v1/projects/${projectId}/profiles/${profileId}/states?limit=10`,
        );
        if (!response.ok) {
          return { kind: 'http-error', status: response.status };
        }

        const body: unknown = await response.json();
        if (!isStateHistoryResponse(body)) {
          return { kind: 'invalid-response' };
        }
        return { kind: 'ready', data: body };
      })();

      const request: InFlightStateHistoryRequest = {
        key: requestKey,
        promise: historyRequest,
      };
      inFlightRequest.current = request;
      const clearRequest = () => {
        if (inFlightRequest.current === request) {
          inFlightRequest.current = null;
        }
      };
      void historyRequest.then(clearRequest, clearRequest);
    }

    void runLatestRequest<HistoryReadResult>(
      requestSequence,
      () => historyRequest,
      (result) => {
        if (result.kind === 'http-error') {
          if (
            handleUnauthorizedResponse(
              result.status,
              `${window.location.pathname}${window.location.search}`,
              (url) => window.location.assign(url),
            )
          ) {
            return;
          }
          setState({ kind: 'error' });
          return;
        }

        if (result.kind === 'invalid-response') {
          setState({ kind: 'error' });
          return;
        }

        setState(
          result.data.states.length === 0
            ? { kind: 'empty', data: result.data }
            : { kind: 'ready', data: result.data },
        );
      },
      () => setState({ kind: 'error' }),
    );
  }, [projectId, profileId, refreshKey]);

  useEffect(() => {
    void load();
    return () => invalidateRequestSequence(requestSequence);
  }, [load, refreshKey]);

  return (
    <section
      className="workspace-section"
      aria-labelledby="state-history-heading"
    >
      <div className="workspace-section-heading">
        <h2 id="state-history-heading">{t('wsHistoryHeading')}</h2>
        <button
          type="button"
          className="text-button"
          onClick={() => void load()}
          disabled={state.kind === 'loading'}
        >
          {state.kind === 'loading' ? t('wsReading') : t('wsHistoryRetry')}
        </button>
      </div>

      {state.kind === 'loading' && (
        <p role="status" className="workspace-meta">
          {t('wsReading')}
        </p>
      )}

      {state.kind === 'empty' && (
        <p className="workspace-meta">{t('wsHistoryEmpty')}</p>
      )}

      {state.kind === 'error' && (
        <p role="alert" className="workspace-error">
          {t('wsHistoryError')}
        </p>
      )}

      {state.kind === 'ready' && (
        <ol className="workspace-list">
          {state.data.states.map((item) => (
            <li key={item.stateId}>
              <article className="workspace-readout">
                <h3 className="workspace-readout-heading">
                  {t('wsHistoryTimestamp')}{' '}
                  <time dateTime={item.timestamp}>{item.timestamp}</time>
                </h3>

                <h4 className="workspace-readout-heading">
                  {t('wsEmotionVector')}
                </h4>
                {EMOTION_LABELS.map((emotion) => (
                  <div key={emotion} className="workspace-readout-row">
                    <span className="workspace-readout-label">
                      {t(EMOTION_LABEL_KEYS[emotion])}
                    </span>
                    <span className="workspace-readout-value">
                      {item.emotionVector[emotion].toFixed(4)}
                    </span>
                  </div>
                ))}

                <h4 className="workspace-readout-heading">
                  {t('wsDimensions')}
                </h4>
                {DIMENSION_LABELS.map((dimension) => (
                  <div key={dimension.key} className="workspace-readout-row">
                    <span className="workspace-readout-label">
                      {t(dimension.labelKey)}
                    </span>
                    <span className="workspace-readout-value">
                      {item.dimensions[dimension.key].toFixed(4)}
                    </span>
                  </div>
                ))}

                <h4 className="workspace-readout-heading">
                  {t('wsModelIdentity')}
                </h4>
                <div className="workspace-readout-row">
                  <span className="workspace-readout-label">{t('name')}</span>
                  <span className="workspace-readout-value">
                    {item.modelIdentity.name}
                  </span>
                </div>
                <div className="workspace-readout-row">
                  <span className="workspace-readout-label">
                    {t('wsVersion')}
                  </span>
                  <span className="workspace-readout-value">
                    {item.modelIdentity.version}
                  </span>
                </div>
                <div className="workspace-readout-row">
                  <span className="workspace-readout-label">
                    {t('wsProvider')}
                  </span>
                  <span className="workspace-readout-value">
                    {item.modelIdentity.providerIdentifier} (
                    {item.modelIdentity.providerVersion})
                  </span>
                </div>
                <div className="workspace-readout-row">
                  <span className="workspace-readout-label">
                    {t('wsParameterIdentity')}
                  </span>
                  <span className="workspace-readout-value">
                    <code>{item.parameterIdentity}</code>
                  </span>
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}

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
