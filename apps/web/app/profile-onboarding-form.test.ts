import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * A2 profile onboarding UI verification (source-scan convention, matching the
 * existing page/wording tests): contract-only fields, endpoint reuse,
 * loading/duplicate protection, envelope-only error rendering, success state,
 * frozen disclosure boundary, and workspace integration.
 */

const formSource = readFileSync(
  fileURLToPath(new URL('./profile-onboarding-form.tsx', import.meta.url)),
  'utf8',
);

const pageSource = readFileSync(
  fileURLToPath(new URL('./app/page.tsx', import.meta.url)),
  'utf8',
);

const PROFILE_FIELD_NAMES = [
  'emotionalSensitivity',
  'baselineTrust',
  'baselineAnxiety',
  'attachmentSensitivity',
  'nostalgiaSensitivity',
  'jealousySensitivity',
] as const;

/** Extracts the frozen profile identity disclosure literal from a source file. */
function extractIdentityDisclosure(source: string): string {
  const match = source.match(/PROFILE_IDENTITY_DISCLOSURE =\s*'([^']+)'/);
  if (!match) throw new Error('frozen profile identity disclosure not found');
  return match[1];
}

describe('A2 profile onboarding surface', () => {
  it('renders the onboarding entry point with the contract-only fields', () => {
    expect(formSource).toContain('Create a profile');
    expect(formSource).toContain('name="externalReference"');
    expect(formSource).toContain('name="additionalTraits"');
    for (const name of PROFILE_FIELD_NAMES) {
      expect(formSource).toContain(`name: '${name}'`);
    }
    expect(formSource).toContain('type="number"');
    expect(formSource).toContain('step="0.01"');
    expect(formSource).toContain('min={0}');
    expect(formSource).toContain('max={1}');
    expect(formSource).toContain('required');
    expect(formSource).toContain('type="submit"');
  });

  it('collects no fields outside the frozen creation contract', () => {
    for (const forbidden of [
      'mlConfiguration',
      'emotionVector',
      'description',
      'emotionalTraits',
      'modelParameters',
      'externalId',
      'confidence',
      'openness:',
    ]) {
      expect(formSource).not.toContain(forbidden);
    }
  });

  it('provides client-side UX validation within the contract bounds', () => {
    expect(formSource).toContain('maxLength={128}');
    expect(formSource).toContain(
      'External reference must be 1 to 128 characters.',
    );
    expect(formSource).toContain(
      'External reference may contain printable characters only.',
    );
    expect(formSource).toContain('Additional traits must be a JSON object.');
  });
});

describe('A2 submission behavior', () => {
  it('posts to the existing profile creation endpoint with the envelope contract', () => {
    expect(formSource).toContain('fetch(');
    expect(formSource).toContain('`/api/v1/projects/${projectId}/profiles`');
    expect(formSource).toContain("method: 'POST'");
    expect(formSource).toContain("'content-type': 'application/json'");
    expect(formSource).toContain('JSON.stringify(payload)');
    expect(formSource).toContain('personalityProfile');
  });

  it('prevents duplicate submissions while a request is in progress', () => {
    expect(formSource).toContain('disabled={pending}');
    expect(formSource).toContain('if (pending) return;');
    expect(formSource).toContain("pending ? 'Creating...' : 'Create profile'");
    expect(formSource).toContain('setPending(false)');
  });

  it('renders a success state after creation', () => {
    expect(formSource).toContain('role="status"');
    expect(formSource).toContain('Profile created');
    expect(formSource).toContain('result.externalReference');
    expect(formSource).toContain('result.profileId');
    expect(formSource).toContain('result.createdAt');
    expect(formSource).toContain('href={`?projectId=${projectId}`}');
  });
});


describe('A2 error safety', () => {
  it('renders only the server envelope message and a safe fallback', () => {
    expect(formSource).toContain('role="alert"');
    expect(formSource).toContain('error?.message');
    expect(formSource).toContain('The profile could not be created.');
  });

  it('never surfaces internal error details', () => {
    for (const forbidden of [
      'error.stack',
      'error.name',
      'error.code',
      'console.error',
      'duplicate key',
      'SQLSTATE',
      'secret',
      'JSON.stringify(error',
    ]) {
      expect(formSource).not.toContain(forbidden);
    }
  });

  it('does not duplicate the server error taxonomy client-side', () => {
    // Frozen server-side messages stay server-side; the client renders the
    // envelope message as-is rather than re-implementing the taxonomy.
    expect(formSource).not.toContain('already exists in this project');
    expect(formSource).not.toContain('unauthenticated');
    expect(formSource).not.toContain('forbidden');
    expect(formSource).not.toContain('invalid_content_type');
    expect(formSource).not.toContain('internal_error');
  });
});

describe('A2 scientific boundary', () => {
  it('reuses the frozen profile identity disclosure byte-identically', () => {
    expect(extractIdentityDisclosure(formSource)).toBe(
      extractIdentityDisclosure(pageSource),
    );
    expect(extractIdentityDisclosure(formSource)).toContain(
      'model-configuration record',
    );
  });

  it('imports the canonical scientific disclosure instead of hardcoding wording', () => {
    expect(formSource).toContain("from '../server/transitions/disclosure'");
    expect(formSource).toContain('SCIENTIFIC_DISCLOSURE_CODE');
    expect(formSource).toContain('SCIENTIFIC_DISCLOSURE_TEXT');
    expect(formSource).not.toContain('EMORA output is a computational');
  });

  it('contains no measurement, diagnosis, or assessment wording', () => {
    for (const forbidden of [
      'true emotion',
      'measured ',
      'personality assessment',
      'psychological profile',
      'diagnos',
      'clinically',
      'test result',
      'EMORA detects',
      'EMORA knows',
      'Person ',
      'Personality of',
    ]) {
      expect(formSource).not.toContain(forbidden);
    }
  });

  it('renders the persistent non-dismissible disclosure markup', () => {
    expect(formSource).toContain('role="note"');
    expect(formSource).toContain('aria-label="Profile identity disclosure"');
    expect(formSource).toContain('aria-label="Scientific disclosure"');
    expect(formSource).toContain('data-disclosure={SCIENTIFIC_DISCLOSURE_CODE}');
  });
});

describe('A2 workspace integration', () => {
  it('renders the onboarding form inside the project-scoped workspace', () => {
    expect(pageSource).toContain('ProfileOnboardingForm');
    expect(pageSource).toContain('projectId={project.projectId}');
  });
});
