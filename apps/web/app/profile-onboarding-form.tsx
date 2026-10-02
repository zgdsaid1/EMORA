'use client';

import { FormEvent, useState } from 'react';

import { handleUnauthorizedResponse } from './session-recovery';

import {
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from '../server/transitions/disclosure';

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
 * Frozen profile identity disclosure. Wording is byte-identical to the
 * workspace surface (apps/web/app/app/page.tsx); verified by
 * profile-onboarding-form.test.ts.
 */
const PROFILE_IDENTITY_DISCLOSURE =
  'This profile is a model-configuration record used for computation; it is not a psychological assessment of a person.' as const;

/**
 * Mirrors the frozen transport bounds of the profile creation contract
 * (1-128 printable ASCII). UX feedback only; the server re-checks.
 */
const EXTERNAL_REFERENCE_PATTERN = /^[\x20-\x7e]+$/;

const PROFILE_FIELDS = [
  { name: 'emotionalSensitivity', label: 'Emotional sensitivity (0 to 1)' },
  { name: 'baselineTrust', label: 'Baseline trust (0 to 1)' },
  { name: 'baselineAnxiety', label: 'Baseline anxiety (0 to 1)' },
  { name: 'attachmentSensitivity', label: 'Attachment sensitivity (0 to 1)' },
  { name: 'nostalgiaSensitivity', label: 'Nostalgia sensitivity (0 to 1)' },
  { name: 'jealousySensitivity', label: 'Jealousy sensitivity (0 to 1)' },
] as const;

interface ProfileCreateResponse {
  readonly requestId: string;
  readonly projectId: string;
  readonly profileId: string;
  readonly externalReference: string;
  readonly createdAt: string;
}

export function ProfileOnboardingForm({ projectId }: { projectId: string }) {
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
      setError('External reference must be 1 to 128 characters.');
      return;
    }
    if (!EXTERNAL_REFERENCE_PATTERN.test(externalReference)) {
      setError('External reference may contain printable characters only.');
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
          setError('Additional traits must be a JSON object.');
          return;
        }
        additionalTraits = parsed as Record<string, number>;
      } catch {
        setError('Additional traits must be a JSON object.');
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
            'The profile could not be created.',
        );
        return;
      }
      setResult(body as ProfileCreateResponse);
    } catch {
      setError('The profile could not be created.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h2>Create a profile</h2>
      <p>
        A profile is a model-configuration record used for computation. Create
        one for this project below.
      </p>
      <form onSubmit={submit}>
        <label>
          External reference
          <input
            name="externalReference"
            type="text"
            maxLength={128}
            autoComplete="off"
            required
          />
        </label>
        <p>1 to 128 printable characters, unique within this project.</p>

        <fieldset>
          <legend>Model configuration</legend>
          {PROFILE_FIELDS.map((field) => (
            <label key={field.name}>
              {field.label}
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
          Additional traits (optional JSON object)
          <textarea
            name="additionalTraits"
            rows={3}
            placeholder={'{"name": 0.5}'}
          />
        </label>
        <p>Metadata only; never consumed by the deterministic dynamics.</p>

        <button type="submit" disabled={pending}>
          {pending ? 'Creating...' : 'Create profile'}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}

      {result && (
        <div role="status">
          <p>Profile created.</p>
          <p>External reference: {result.externalReference}</p>
          <p>
            Project {result.projectId} · profile {result.profileId}
          </p>
          <p>Created at {result.createdAt}</p>
          <p>
            <a href={`?projectId=${projectId}`}>
              Reload the workspace to see the new profile.
            </a>
          </p>
        </div>
      )}

      {/* Persistent, non-dismissible profile identity disclosure. */}
      <aside role="note" aria-label="Profile identity disclosure">
        <p>{PROFILE_IDENTITY_DISCLOSURE}</p>
      </aside>

      {/* Persistent, non-dismissible scientific disclosure. */}
      <aside
        role="note"
        data-disclosure={SCIENTIFIC_DISCLOSURE_CODE}
        aria-label="Scientific disclosure"
      >
        <p>{SCIENTIFIC_DISCLOSURE_TEXT}</p>
      </aside>
    </section>
  );
}
