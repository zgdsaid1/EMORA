'use client';

/**
 * Minimal client presentation boundary for the /app workspace. The page itself
 * (apps/web/app/app/page.tsx) remains a server component: authentication,
 * membership-scoped discovery, and the development-only fixture gate stay
 * server-side and untouched. This component only renders already-resolved,
 * serializable identity data through the existing EN/FR/AR presentation
 * dictionary — locale never enters requests, computation, or persistence.
 */

import { BootstrapForm } from './bootstrap-form';
import { LatestStatePanel } from './latest-state-panel';
import { LogoutButton } from './logout-button';
import { ProfileOnboardingForm } from './profile-onboarding-form';
import { TransitionForm } from './transition-form';
import { usePreferences } from './shell/preferences';

export interface WorkspaceProjectSummary {
  readonly projectId: string;
  readonly name: string;
}

export interface WorkspaceProfileSummary {
  readonly profileId: string;
  readonly externalReference: string;
}

export function WorkspaceView({
  sessionEmail,
  projects,
  profiles,
  project,
  profile,
}: {
  sessionEmail: string;
  projects: readonly WorkspaceProjectSummary[];
  profiles: readonly WorkspaceProfileSummary[];
  project?: WorkspaceProjectSummary;
  profile?: WorkspaceProfileSummary;
}) {
  const { t } = usePreferences();

  return (
    <main className="workspace-view">
      <header className="workspace-heading">
        <span className="page-kicker">{t('instrument')}</span>
        <h1>{t('wsTitle')}</h1>
        <p className="workspace-signed-in">
          {t('wsSignedInAs')} {sessionEmail}.
        </p>
      </header>

      <LogoutButton />

      {projects.length === 0 ? (
        <section className="workspace-section">
          <div className="workspace-section-heading">
            <h2>{t('wsNoProjectHeading')}</h2>
          </div>
          <p>{t('wsNoProjectBody')}</p>
          <BootstrapForm />
        </section>
      ) : (
        <>
          <section className="workspace-section">
            <div className="workspace-section-heading">
              <h2>{t('wsProjects')}</h2>
            </div>
            <ul className="workspace-list">
              {projects.map((candidate) => (
                <li key={candidate.projectId}>
                  <a
                    href={`?projectId=${candidate.projectId}`}
                    aria-current={
                      candidate.projectId === project?.projectId
                        ? 'true'
                        : undefined
                    }
                  >
                    <span>{candidate.name}</span>
                    <span className="workspace-item-id">
                      {candidate.projectId}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="workspace-section">
            <div className="workspace-section-heading">
              <h2>{t('wsProfiles')}</h2>
            </div>
            {profiles.length === 0 ? (
              <p>{t('wsNoProfilesBody')}</p>
            ) : (
              <ul className="workspace-list">
                {profiles.map((candidate) => (
                  <li key={candidate.profileId}>
                    <a
                      href={`?projectId=${project?.projectId}&profileId=${candidate.profileId}`}
                      aria-current={
                        candidate.profileId === profile?.profileId
                          ? 'true'
                          : undefined
                      }
                    >
                      <span>
                        {t('wsExternalReference')}{' '}
                        {candidate.externalReference}
                      </span>
                      <span className="workspace-item-id">
                        {candidate.profileId}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {/* Slice 3 G2-C2 profile identity disclosure (presentation-layer
                translation of the frozen English semantic definition). */}
            <aside
              role="note"
              className="workspace-note"
              aria-label={t('wsProfileIdentityDisclosureLabel')}
            >
              <p>{t('wsProfileIdentityDisclosure')}</p>
            </aside>
            {/* A2: project-scoped profile onboarding over the existing
                creation contract (server remains authoritative). */}
            {project && <ProfileOnboardingForm projectId={project.projectId} />}
          </section>

          {profile && project ? (
            <>
              <p className="workspace-meta">
                {t('wsProjectLabel')} <code>{project.projectId}</code> ·{' '}
                {t('wsProfileLabel')} <code>{profile.profileId}</code>
              </p>
              <LatestStatePanel
                projectId={project.projectId}
                profileId={profile.profileId}
              />
              <TransitionForm
                projectId={project.projectId}
                profileId={profile.profileId}
              />
            </>
          ) : (
            <section className="workspace-section">
              <div className="workspace-section-heading">
                <h2>{t('wsNoProfileSelectedHeading')}</h2>
              </div>
              <p>{t('wsNoProfileSelectedBody')}</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
