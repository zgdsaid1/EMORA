'use client';

import { FormEvent, useState } from 'react';

import { handleUnauthorizedResponse } from './session-recovery';
import { usePreferences } from './shell/preferences';

import { SCIENTIFIC_DISCLOSURE_CODE } from '../server/transitions/disclosure';

/**
 * A2 profile onboarding: create one project-scoped profile through the frozen
 * Slice 3 creation contract (POST /api/v1/projects/{projectId}/profiles).
 *
 * A profile is an engineering data structure — a model-configuration record
 * used for computation. This form never claims to measure or assess a person's
 * psychological or emotional state. Client-side checks are UX only; the server
 * remains the authoritative source of validation truth.
 */

/**
 * Mirrors the frozen transport bounds of the profile creation contract
 * (1-128 printable ASCII). UX feedback only; the server re-checks.
 */
const EXTERNAL_REFERENCE_PATTERN = /^[\x20-\x7e]+$/;

const PROFILE_FIELDS = [
  { name: 'emotionalSensitivity', labelKey: 'wsFieldEmotionalSensitivity' },
  { name: 'baselineTrust', labelKey: 'wsFieldBaselineTrust' },
  { name: 'baselineAnxiety', labelKey: 'wsFieldBaselineAnxiety' },
  { name: 'attachmentSensitivity', labelKey: 'wsFieldAttachmentSensitivity' },
  { name: 'nostalgiaSensitivity', labelKey: 'wsFieldNostalgiaSensitivity' },
  { name: 'jealousySensitivity', labelKey: 'wsFieldJealousySensitivity' },
] as const;

interface ProfileCreateResponse {
  readonly requestId: string;
  readonly projectId: string;
  readonly profileId: string;
  readonly externalReference: string;
  readonly createdAt: string;
}

export function ProfileOnboardingForm({ projectId }: { projectId: string }) {
  const { t } = usePreferences();
  const [result, setResult] = useState<ProfileCreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A submission is already in flight: never send a second request.
    if (pending) return;
    setResult(null);
    setError(null);

    const formData = new FormData(event.currentTarget);

    const externalReference = String(formData.get('externalReference') ?? '');
    if (externalReference.length < 1 || externalReference.length > 128) {
      setError(t('wsExtRefLength'));
      return;
    }
    if (!EXTERNAL_REFERENCE_PATTERN.test(externalReference)) {
      setError(t('wsExtRefPrintable'));
      return;
    }

    const personalityProfile: Record<string, number> = {};
    for (const field of PROFILE_FIELDS) {
      personalityProfile[field.name] = Number(formData.get(field.name) ?? '');
    }

    let additionalTraits: Record<string, number> | undefined;
    const traitsText = String(formData.get('additionalTraits') ?? '').trim();
    if (traitsText.length > 0) {
      try {
        const parsed: unknown = JSON.parse(traitsText);
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          setError(t('wsTraitsObject'));
          return;
        }
        additionalTraits = parsed as Record<string, number>;
      } catch {
        setError(t('wsTraitsObject'));
        return;
      }
    }

    const payload: Record<string, unknown> = {
      externalReference,
      personalityProfile,
      ...(additionalTraits === undefined ? {} : { additionalTraits }),
    };

    setPending(true);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/profiles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
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
        ProfileCreateResponse | { error?: { message?: string } };

      if (!response.ok) {
        setError(
          (body as { error?: { message?: string } }).error?.message ??
            t('wsProfileCreateFailed'),
        );
        return;
      }
      setResult(body as ProfileCreateResponse);
    } catch {
      setError(t('wsProfileCreateFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h2>{t('wsCreateProfile')}</h2>
      <p>{t('wsCreateProfileIntro')}</p>
      <form onSubmit={submit}>
        <label>
          {t('wsExternalReference')}
          <input
            name="externalReference"
            type="text"
            maxLength={128}
            autoComplete="off"
            required
          />
        </label>
        <p>{t('wsExternalReferenceHint')}</p>

        <fieldset>
          <legend>{t('wsModelConfiguration')}</legend>
          {PROFILE_FIELDS.map((field) => (
            <label key={field.name}>
              {t(field.labelKey)}
              <input
                name={field.name}
                type="number"
                step="0.01"
                min={0}
                max={1}
                defaultValue="0.5"
                required
              />
            </label>
          ))}
        </fieldset>

        <label>
          {t('wsAdditionalTraits')}
          <textarea
            name="additionalTraits"
            rows={3}
            placeholder={'{"name": 0.5}'}
          />
        </label>
        <p>{t('wsAdditionalTraitsHint')}</p>

        <button type="submit" disabled={pending}>
          {pending ? t('wsCreatingProfile') : t('wsCreateProfileAction')}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      {result && (
        <div role="status">
          <p>{t('wsProfileCreated')}</p>
          <p>
            {t('wsExternalReference')}: {result.externalReference}
          </p>
          <p>
            {t('wsProjectLabel')} {result.projectId} ·{' '}
            {t('wsProfileLabel')} {result.profileId}
          </p>
          <p>
            {t('wsCreatedAt')} {result.createdAt}
          </p>
          <p>
            <a href={`?projectId=${projectId}`}>
              {t('wsReloadWorkspace')}
            </a>
          </p>
        </div>
      )}

      {/* Persistent, non-dismissible profile identity disclosure. The
          presentation translation keys the frozen English semantic
          definition; locale never changes its meaning. */}
      <aside
        role="note"
        aria-label={t('wsProfileIdentityDisclosureLabel')}
      >
        <p>{t('wsProfileIdentityDisclosure')}</p>
      </aside>

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
