import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { messages } from './shell/messages';

/**
 * A2 profile onboarding UI verification (source-scan convention, matching the
 * existing page/wording tests): contract-only fields, endpoint reuse,
 * loading/duplicate protection, envelope-only error rendering, success state,
 * frozen disclosure boundary, and workspace integration.
 *
 * M0: visible wording resolves through the EN/FR/AR presentation dictionary;
 * the EN dictionary preserves the previously frozen English wording.
 */

const formSource = readFileSync(
  fileURLToPath(new URL('./profile-onboarding-form.tsx', import.meta.url)),
  'utf8',
);

const workspaceSource = readFileSync(
  fileURLToPath(new URL('./workspace-view.tsx', import.meta.url)),
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

describe('A2 profile onboarding surface', () => {
  it('renders the onboarding entry point with the contract-only fields', () => {
    expect(formSource).toContain("t('wsCreateProfile')");
    expect(messages.en.wsCreateProfile).toBe('Create a profile');
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
    expect(formSource).toContain("t('wsExtRefLength')");
    expect(formSource).toContain("t('wsExtRefPrintable')");
    expect(formSource).toContain("t('wsTraitsObject')");
    expect(messages.en.wsExtRefLength).toBe(
      'External reference must be 1 to 128 characters.',
    );
    expect(messages.en.wsExtRefPrintable).toBe(
      'External reference may contain printable characters only.',
    );
    expect(messages.en.wsTraitsObject).toBe(
      'Additional traits must be a JSON object.',
    );
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
    expect(formSource).toContain(
      "pending ? t('wsCreatingProfile') : t('wsCreateProfileAction')",
    );
    expect(formSource).toContain('setPending(false)');
  });

  it('renders a success state after creation', () => {
    expect(formSource).toContain('role="status"');
    expect(formSource).toContain("t('wsProfileCreated')");
    expect(messages.en.wsProfileCreated).toBe('Profile created.');
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
    expect(formSource).toContain("t('wsProfileCreateFailed')");
    expect(messages.en.wsProfileCreateFailed).toBe(
      'The profile could not be created.',
    );
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
  it('renders the profile identity disclosure through the shared dictionary', () => {
    expect(formSource).toContain(
      "aria-label={t('wsProfileIdentityDisclosureLabel')}",
    );
    expect(formSource).toContain("{t('wsProfileIdentityDisclosure')}");
    // One frozen semantic definition; EN/FR/AR presentation translations.
    expect(messages.en.wsProfileIdentityDisclosure).toContain(
      'model-configuration record',
    );
    expect(messages.fr.wsProfileIdentityDisclosure).toContain(
      'configuration du modèle',
    );
    expect(messages.ar.wsProfileIdentityDisclosure).toContain(
      'سجل لإعدادات النموذج',
    );
  });

  it('resolves the scientific disclosure through the dictionary keyed by the canonical code', () => {
    expect(formSource).toMatch(/from '.+server\/transitions\/disclosure'/);
    expect(formSource).toContain('SCIENTIFIC_DISCLOSURE_CODE');
    expect(formSource).not.toContain('SCIENTIFIC_DISCLOSURE_TEXT');
    expect(formSource).not.toContain('EMORA output is a computational');
    expect(formSource).toContain("t('disclosureText')");
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
    expect(formSource).toContain(
      "aria-label={t('wsProfileIdentityDisclosureLabel')}",
    );
    expect(formSource).toContain("aria-label={t('disclosureLabel')}");
    expect(formSource).toContain('data-disclosure={SCIENTIFIC_DISCLOSURE_CODE}');
  });
});

describe('A2 workspace integration', () => {
  it('renders the onboarding form inside the project-scoped workspace', () => {
    expect(workspaceSource).toContain('ProfileOnboardingForm');
    expect(workspaceSource).toContain('projectId={project.projectId}');
  });
});

describe('first-user bootstrap form', () => {
  it('collects explicit names and slugs and posts only the bootstrap contract', () => {
    const bootstrapSource = readFileSync(
      fileURLToPath(new URL('./bootstrap-form.tsx', import.meta.url)),
      'utf8',
    );
    for (const name of [
      'organizationName',
      'organizationSlug',
      'projectName',
      'projectSlug',
    ]) {
      expect(bootstrapSource).toContain(`name="${name}"`);
    }
    expect(bootstrapSource).toContain("fetch('/api/v1/bootstrap'");
    expect(bootstrapSource).toContain("method: 'POST'");
    expect(bootstrapSource).toContain("window.location.assign('/app')");
    const payloadStart = bootstrapSource.indexOf('const payload = {');
    const payloadEnd = bootstrapSource.indexOf('\n    };', payloadStart);
    expect(payloadStart).toBeGreaterThanOrEqual(0);
    expect(payloadEnd).toBeGreaterThan(payloadStart);
    const payload = bootstrapSource.slice(payloadStart, payloadEnd);
    expect(payload).not.toContain('organizationId');
    expect(payload).not.toContain('userId');
    expect(payload).not.toContain('role');
  });

  it('offers bootstrap only in the no-authorized-project state', () => {
    expect(workspaceSource).toContain('<BootstrapForm />');
    expect(workspaceSource).toContain('projects.length === 0');
  });
});
