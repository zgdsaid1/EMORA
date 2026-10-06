import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { messages } from '../shell/messages';

/**
 * A3 profile read/select/use integration verification (source-scan
 * convention, matching the existing page/wording tests). The workspace page is
 * a server component: profiles are read through the existing membership-scoped
 * discovery service (the same contract as the project-scoped GET endpoint),
 * selection is server-derived URL state, and the selected profile feeds the
 * existing latest-state/transition panels by reference only. No second read
 * path, no client-side ownership assumptions, no new model pathway.
 *
 * M0: presentation is rendered on the minimal client boundary
 * (workspace-view.tsx) through the EN/FR/AR presentation dictionary.
 */

const pageSource = readFileSync(
  fileURLToPath(new URL('./page.tsx', import.meta.url)),
  'utf8',
);

const workspaceSource = readFileSync(
  fileURLToPath(new URL('../workspace-view.tsx', import.meta.url)),
  'utf8',
);

const discoverySource = readFileSync(
  fileURLToPath(new URL('../../server/discovery.ts', import.meta.url)),
  'utf8',
);

describe('A3 profile read integration', () => {
  it('reads profiles through the existing membership-scoped discovery service', () => {
    expect(pageSource).toContain(
      'discoverAuthorizedProfiles(session.user.id, project.projectId)',
    );
    expect(discoverySource).toContain(
      "requireProjectAccess(userId, projectId, 'VIEWER')",
    );
    expect(discoverySource).toContain('listProjectProfiles');
  });

  it('scopes the profile list to the active project only', () => {
    expect(discoverySource).toContain('listProjectProfiles({');
    expect(discoverySource).toContain('projectId,');
    expect(pageSource).toContain(
      'discoverAuthorizedProfiles(session.user.id, project.projectId)',
    );
  });

  it('queries no database directly and creates no second read path', () => {
    // Server service layer only — the same contract as the existing GET route.
    expect(discoverySource).toContain("from './profiles/service'");
    expect(pageSource).not.toContain('@emora/database');
    expect(pageSource).not.toContain('fetch(');
    expect(pageSource).not.toContain("'/api/");
  });
});

describe('A3 profile selection', () => {
  it('allows selecting one profile by reference and marks the selection', () => {
    expect(workspaceSource).toContain(
      'href={`?projectId=${project?.projectId}&profileId=${candidate.profileId}`}',
    );
    expect(pageSource).toContain('requestedProfileId');
    expect(pageSource).toContain(
      'profiles.find((candidate) => candidate.profileId === requestedProfileId)',
    );
    expect(workspaceSource).toContain('aria-current=');
  });

  it('keeps the selected profile explicitly bound to the active project', () => {
    // Selection preserves the project in the URL and every consumer receives
    // the server-derived (projectId, profileId) pair together.
    expect(workspaceSource).toContain(
      'href={`?projectId=${project?.projectId}&profileId=${candidate.profileId}`}',
    );
    expect(workspaceSource).toContain('projectId={project.projectId}');
    expect(workspaceSource).toContain('profileId={profile.profileId}');
    // The summary line resolves through the dictionary (M0).
    expect(workspaceSource).toContain("t('wsProjectLabel')");
    expect(workspaceSource).toContain("t('wsProfileLabel')");
    expect(messages.en.wsProjectLabel).toBe('Project');
    expect(messages.en.wsProfileLabel).toBe('Profile');
  });
});

describe('A3 profile list states', () => {
  it('renders a safe empty state with a path back to onboarding', () => {
    expect(workspaceSource).toContain("t('wsNoProfilesBody')");
    expect(messages.en.wsNoProfilesBody).toContain(
      'No profile record is available in this project yet',
    );
    expect(messages.en.wsNoProfilesBody).toContain('Create one below');
    expect(workspaceSource).toContain(
      '<ProfileOnboardingForm projectId={project.projectId} />',
    );
  });

  it('distinguishes multiple profiles by external reference and id', () => {
    expect(workspaceSource).toContain("t('wsExternalReference')");
    expect(workspaceSource).toContain('candidate.externalReference');
    expect(workspaceSource).toContain('candidate.profileId');
    expect(workspaceSource).toContain('profiles.map((candidate) =>');
  });
});


describe('A3 error safety and ownership', () => {
  it('renders errors safely without internal details', () => {
    // Authorization failures collapse to the controlled empty state (never an
    // existence oracle); only infrastructure failures rethrow server-side.
    expect(discoverySource).toContain(
      'if (error instanceof AuthorizationError) return [];',
    );
    for (const forbidden of [
      'error.stack',
      'error.message',
      'console.error',
      'internal_error',
      'SQLSTATE',
    ]) {
      expect(pageSource).not.toContain(forbidden);
    }
  });

  it('assumes no client-side profile ownership', () => {
    // The workspace is a server component: selection is resolved from the
    // server-derived, project-scoped profile list. Discovery never authorizes
    // by itself and re-derives access through requireProjectAccess.
    expect(pageSource).not.toContain("'use client'");
    expect(discoverySource).toContain('never authorizes anything by itself');
    expect(discoverySource).toContain('requireProjectAccess');
  });
});

describe('A3 boundary and compatibility', () => {
  it('preserves the frozen disclosure and introduces no measurement claims', () => {
    expect(workspaceSource).toContain(
      "aria-label={t('wsProfileIdentityDisclosureLabel')}",
    );
    expect(workspaceSource).toContain("{t('wsProfileIdentityDisclosure')}");
    for (const forbidden of [
      'true emotion',
      'measured anxiety',
      'measured trust',
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
      expect(pageSource).not.toContain(forbidden);
      expect(workspaceSource).not.toContain(forbidden);
    }
  });

  it('keeps A1/A2 and the existing use flow compatible', () => {
    // A2 onboarding entry point remains mounted.
    expect(workspaceSource).toContain('<ProfileOnboardingForm');
    // Existing use flow: the selected profile reference feeds the existing
    // latest-state panel and transition form (no new model pathway).
    expect(workspaceSource).toContain('<LatestStatePanel');
    expect(workspaceSource).toContain('<TransitionForm');
    expect(workspaceSource).toContain('profileId={profile.profileId}');
    // The no-selection empty state resolves through the dictionary (M0).
    expect(workspaceSource).toContain("t('wsNoProfileSelectedHeading')");
    expect(messages.en.wsNoProfileSelectedHeading).toBe(
      'No profile is selected',
    );
    expect(messages.en.wsNoProfileSelectedBody).toContain(
      'Select a profile above',
    );
  });
});
