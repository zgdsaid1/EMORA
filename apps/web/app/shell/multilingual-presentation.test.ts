import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from '../../server/transitions/disclosure';
import { messages, type Locale } from './messages';

/**
 * M0 multilingual presentation boundary regression suite.
 *
 * Locale is presentation metadata ONLY: it must never reach the deterministic
 * emotional core, requests, requestDigest, audit metadata, or persistence.
 * These tests pin the presentation boundary and the scientific disclosure
 * governance identified by the multilingual boundary audit.
 */

const LOCALES: readonly Locale[] = ['en', 'fr', 'ar'];

function readAppSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
    'utf8',
  );
}

/** Source with comments removed, so scans target user-facing code only. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

/** Client presentation surfaces that render the scientific disclosure. */
const DISCLOSURE_SURFACES = [
  'shell/overview-page.tsx',
  'latest-state-panel.tsx',
  'transition-form.tsx',
  'profile-onboarding-form.tsx',
] as const;

/** Implemented /app workspace client surfaces. */
const WORKSPACE_SURFACES = [
  'workspace-view.tsx',
  'latest-state-panel.tsx',
  'transition-form.tsx',
  'profile-onboarding-form.tsx',
  'bootstrap-form.tsx',
  'logout-button.tsx',
] as const;

const FR_DISCLOSURE =
  "Le résultat d’EMORA est un état émotionnel calculé et estimé par un modèle, dérivé de l’événement et du contexte que vous avez fournis, à l’aide du modèle déterministe d’EMORA. Il ne constitue pas une mesure de l’état émotionnel réel d’une personne. Il ne constitue pas une détection de l’état émotionnel réel d’une personne. Il ne s’agit pas d’un diagnostic. Il ne s’agit pas d’une évaluation clinique. Il n’établit pas la validité psychologique et ne doit pas être utilisé comme preuve de ce qu’une personne ressent réellement.";

const AR_DISCLOSURE =
  'مخرَج EMORA هو حالة عاطفية حاسوبية مقدّرة بواسطة نموذج، مشتقة من الحدث والسياق اللذين قدّمتهما، باستخدام نموذج EMORA الحتمي. ولا تمثّل هذه الحالة قياسًا للحالة العاطفية الحقيقية لشخص. كما أنها ليست كشفًا عن الحالة العاطفية الحقيقية لشخص. وليست تشخيصًا. وليست تقييمًا سريريًا. ولا تثبت الصلاحية النفسية، ولا يجوز استخدامها دليلًا على ما يشعر به الشخص فعليًا.';

describe('M0 multilingual presentation: translation dictionary', () => {
  it('keeps EN/FR/AR key parity with non-empty values', () => {
    const enKeys = Object.keys(messages.en).sort();
    expect(enKeys.length).toBeGreaterThan(0);
    for (const locale of LOCALES) {
      expect(Object.keys(messages[locale]).sort()).toEqual(enKeys);
      for (const [key, value] of Object.entries(messages[locale])) {
        expect(typeof value).toBe('string');
        expect((value as string).length, `${locale}/${key}`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it('resolves every EN key in every locale without English fallback', () => {
    for (const locale of LOCALES) {
      const dictionary: Record<string, string> = messages[locale];
      for (const key of Object.keys(messages.en)) {
        // A missing key would silently fall back to English: catch it here.
        expect(dictionary[key], `${locale}/${key}`).toBeDefined();
      }
    }
  });

  it('uses ASCII digits consistently in all locales (F-5)', () => {
    // Deliberate presentation decision: scientific counts/readouts in the
    // dictionary stay ASCII; Arabic-Indic digits are never forced.
    const arabicIndic = /[\u0660-\u0669]/;
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(messages[locale])) {
        expect(
          arabicIndic.test(value as string),
          `${locale}/${key} uses Arabic-Indic digits`,
        ).toBe(false);
      }
    }
    expect(messages.ar.overviewKicker).toBe('المرصد / 00');
  });
});

describe('M0 multilingual presentation: scientific disclosure', () => {
  it('exists in all three locales (F-2)', () => {
    for (const locale of LOCALES) {
      expect(messages[locale].disclosureText.length).toBeGreaterThan(0);
      expect(messages[locale].disclosureLabel.length).toBeGreaterThan(0);
      expect(
        messages[locale].wsProfileIdentityDisclosureLabel.length,
      ).toBeGreaterThan(0);
    }
  });

  it('keeps the EN presentation identical to the frozen server canonical text', () => {
    expect(messages.en.disclosureText).toBe(SCIENTIFIC_DISCLOSURE_TEXT);
  });

  it('pins the reviewed FR and AR presentation translations (F-1)', () => {
    expect(messages.fr.disclosureText).toBe(FR_DISCLOSURE);
    expect(messages.ar.disclosureText).toBe(AR_DISCLOSURE);
  });

  it('preserves every required scientific boundary concept in EN', () => {
    const text = SCIENTIFIC_DISCLOSURE_TEXT;
    expect(text).toContain('computational');
    expect(text).toContain('model-estimated');
    expect(text).toContain('derived from the event and context you supplied');
    expect(text).toContain("using EMORA's deterministic model");
    expect(text).toContain('It is not a measurement');
    expect(text).toContain('It is not a detection');
    expect(text).toContain('It is not a diagnosis');
    expect(text).toContain('It is not a clinical assessment');
    expect(text).toContain('It does not establish psychological validity');
    expect(text).toContain('must not be used as evidence');
  });

  it('preserves every required scientific boundary concept in FR', () => {
    const fr = messages.fr.disclosureText;
    expect(fr).toContain('calculé');
    expect(fr).toContain('estimé par un modèle');
    expect(fr).toContain('modèle déterministe');
    expect(fr).toContain('pas une mesure');
    expect(fr).toContain('pas une détection');
    expect(fr).toContain('pas d’un diagnostic');
    expect(fr).toContain('pas d’une évaluation clinique');
    expect(fr).toContain('n’établit pas la validité psychologique');
    expect(fr).toContain('ne doit pas être utilisé comme preuve');
  });

  it('preserves every required scientific boundary concept in AR', () => {
    const ar = messages.ar.disclosureText;
    expect(ar).toContain('حاسوبية');
    expect(ar).toContain('مقدّرة بواسطة نموذج');
    expect(ar).toContain('الحتمي');
    expect(ar).toContain('لا تمثّل هذه الحالة قياسًا');
    expect(ar).toContain('ليست كشفًا');
    expect(ar).toContain('ليست تشخيصًا');
    expect(ar).toContain('تقييمًا سريريًا');
    expect(ar).toContain('لا تثبت الصلاحية النفسية');
    expect(ar).toContain('دليلًا');
  });

  it('keeps the profile identity disclosure scientific in all locales', () => {
    expect(messages.en.wsProfileIdentityDisclosure).toContain(
      'model-configuration record',
    );
    expect(messages.en.wsProfileIdentityDisclosure).toContain(
      'not a psychological assessment',
    );
    expect(messages.fr.wsProfileIdentityDisclosure).toContain(
      'configuration du modèle',
    );
    expect(messages.fr.wsProfileIdentityDisclosure).toContain(
      'pas une évaluation psychologique',
    );
    expect(messages.ar.wsProfileIdentityDisclosure).toContain(
      'سجل لإعدادات النموذج',
    );
    expect(messages.ar.wsProfileIdentityDisclosure).toContain(
      'ليس تقييمًا نفسيًا',
    );
  });
});

describe('M0 multilingual presentation: consistent disclosure consumption', () => {
  it('resolves every disclosure surface through the same code and key (F-2)', () => {
    for (const surface of DISCLOSURE_SURFACES) {
      const source = readAppSource(surface);
      expect(source).toContain('SCIENTIFIC_DISCLOSURE_CODE');
      expect(source).toMatch(/from '.+server\/transitions\/disclosure'/);
      expect(source).toContain('data-disclosure={SCIENTIFIC_DISCLOSURE_CODE}');
      expect(source).toContain("t('disclosureText')");
    }
  });

  it('renders the same canonical disclosure code on every surface', () => {
    expect(SCIENTIFIC_DISCLOSURE_CODE).toBe(
      'COMPUTATIONAL_MODEL_ESTIMATED_STATE_NOT_HUMAN_MEASUREMENT',
    );
  });

  it('renders no duplicated hard-coded disclosure paragraph on any client surface', () => {
    for (const surface of [
      ...DISCLOSURE_SURFACES,
      'workspace-view.tsx',
      'bootstrap-form.tsx',
      'logout-button.tsx',
    ]) {
      const source = readAppSource(surface);
      expect(
        source.includes('EMORA output is a computational'),
        `${surface} duplicates the disclosure paragraph`,
      ).toBe(false);
      expect(
        source.includes('SCIENTIFIC_DISCLOSURE_TEXT'),
        `${surface} imports the canonical text constant`,
      ).toBe(false);
    }
  });
});

describe('M0 multilingual presentation: accessibility labels (F-8)', () => {
  it('exists in EN/FR/AR for the scientific and profile disclosures', () => {
    for (const locale of LOCALES) {
      expect(messages[locale].disclosureLabel.length).toBeGreaterThan(0);
      expect(
        messages[locale].wsProfileIdentityDisclosureLabel.length,
      ).toBeGreaterThan(0);
    }
    expect(messages.en.disclosureLabel).toBe('Scientific disclosure');
    expect(messages.fr.disclosureLabel).not.toBe(messages.en.disclosureLabel);
    expect(messages.ar.disclosureLabel).not.toBe(messages.en.disclosureLabel);
  });

  it('localizes disclosure accessible names on the workspace surfaces', () => {
    for (const surface of DISCLOSURE_SURFACES) {
      expect(readAppSource(surface)).toContain(
        "aria-label={t('disclosureLabel')}",
      );
    }
    expect(readAppSource('workspace-view.tsx')).toContain(
      "aria-label={t('wsProfileIdentityDisclosureLabel')}",
    );
    expect(readAppSource('profile-onboarding-form.tsx')).toContain(
      "aria-label={t('wsProfileIdentityDisclosureLabel')}",
    );
    for (const surface of [...DISCLOSURE_SURFACES, 'workspace-view.tsx']) {
      const source = readAppSource(surface);
      expect(source).not.toContain('aria-label="Scientific disclosure"');
      expect(source).not.toContain(
        'aria-label="Profile identity disclosure"',
      );
    }
  });
});

describe('M0 multilingual presentation: /app string coverage (G)', () => {
  it('uses the translation system for every implemented workspace string', () => {
    for (const surface of WORKSPACE_SURFACES) {
      const source = stripComments(readAppSource(surface));
      // Machine tokens, numeric bounds, JSON placeholders, and server-derived
      // data fields are the only language-neutral literals allowed to remain.
      for (const forbidden of [
        'Most recent computational state',
        'Refresh state',
        'Reading...',
        'No computational state has been computed',
        'The latest state could not be read',
        'Emotion vector',
        'Model identity',
        'Parameter identity',
        'Computed at ',
        'Submit a structured event',
        'Valence (-1 to 1)',
        'Intensity (0 to 1)',
        'Relevance (0 to 1)',
        'Surprise (0 to 1)',
        'Uncertainty (0 to 1)',
        'Context (optional JSON)',
        'Run deterministic transition',
        'Computing...',
        'Context must be valid JSON.',
        'The transition could not be completed.',
        'Computational model-estimated state',
        'Previously persisted result.',
        'Create a profile',
        'External reference',
        '1 to 128 printable characters',
        'Model configuration',
        'Emotional sensitivity (0 to 1)',
        'Baseline trust (0 to 1)',
        'Baseline anxiety (0 to 1)',
        'Attachment sensitivity (0 to 1)',
        'Nostalgia sensitivity (0 to 1)',
        'Jealousy sensitivity (0 to 1)',
        'Additional traits (optional JSON object)',
        'Metadata only; never consumed',
        'Create profile',
        'Creating...',
        'must be 1 to 128 characters',
        'printable characters only',
        'must be a JSON object',
        'The profile could not be created.',
        'Profile created.',
        'Created at ',
        'Reload the workspace',
        'Organization name',
        'Organization slug',
        'Initial project name',
        'Initial project slug',
        'Creating workspace...',
        'Create workspace',
        'The workspace could not be initialized.',
        'Log out',
        'HYBRID EMOTIONAL ENGINE',
        'Signed in as',
        'No authorized project is available',
        'No profile is selected',
        'Select a profile above',
        'model-configuration record',
        'psychological assessment of a person',
        'No profile record is available',
      ]) {
        expect(source, `${forbidden} bypasses translation in ${surface}`).not.toContain(
          forbidden,
        );
      }
      // Headings that previously bypassed the dictionary (single words).
      expect(source).not.toMatch(/>\s*Projects\s*</);
      expect(source).not.toMatch(/>\s*Profiles\s*</);
    }
  });

  it('keeps the workspace headings and empty states in the dictionary', () => {
    expect(messages.en.wsTitle).toBe('HYBRID EMOTIONAL ENGINE');
    expect(messages.en.wsSignedInAs).toBe('Signed in as');
    expect(messages.en.wsNoProjectHeading).toBe(
      'No authorized project is available',
    );
    expect(messages.en.wsNoProfileSelectedHeading).toBe(
      'No profile is selected',
    );
    expect(messages.en.wsNoProfileSelectedBody).toContain(
      'Select a profile above',
    );
    expect(messages.en.wsNoProfilesBody).toContain(
      'No profile record is available',
    );
    expect(messages.en.wsCreateProfileIntro).toContain(
      'model-configuration record',
    );
    expect(messages.en.wsProjects).toBe('Projects');
    expect(messages.en.wsProfiles).toBe('Profiles');
  });

  it('renders server-derived identity data through the dictionary', () => {
    const workspace = readAppSource('workspace-view.tsx');
    expect(workspace).toContain("t('wsExternalReference')");
    expect(workspace).toContain('candidate.externalReference');
    expect(workspace).toContain('candidate.profileId');
    expect(workspace).toContain("t('wsProjectLabel')");
    expect(workspace).toContain("t('wsProfileLabel')");
  });
});

describe('M0 multilingual presentation: language-invariance boundary', () => {
  it('never exposes locale to the /app server page or request payloads', () => {
    // Locale exists only in the client preferences store (presentation).
    const serverAndSurfaceFiles = [
      'app/page.tsx',
      'workspace-view.tsx',
      'latest-state-panel.tsx',
      'transition-form.tsx',
      'profile-onboarding-form.tsx',
      'bootstrap-form.tsx',
      'logout-button.tsx',
    ];
    for (const file of serverAndSurfaceFiles) {
      const source = stripComments(readAppSource(file));
      expect(source, `${file} reads locale directly`).not.toMatch(/\blocale\b/);
    }
  });

  it('keeps the /app page server-rendered behind the minimal client boundary', () => {
    const page = stripComments(readAppSource('app/page.tsx'));
    expect(page).not.toContain("'use client'");
    expect(page).toContain('WorkspaceView');
    // The server page passes only serializable identity data — no locale,
    // no dictionary, no presentation concerns.
    expect(page).not.toMatch(/\blocale\b/);
    expect(page).not.toContain('usePreferences');
    const workspace = stripComments(readAppSource('workspace-view.tsx'));
    expect(workspace).toContain("'use client'");
    expect(workspace).toContain('usePreferences');
  });
});


