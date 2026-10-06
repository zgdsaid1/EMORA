'use client';

import { FormEvent, useState } from 'react';

import { handleUnauthorizedResponse } from './session-recovery';
import { usePreferences } from './shell/preferences';

interface BootstrapResponse {
  readonly requestId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly organizationSlug: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly projectSlug: string;
}

export function BootstrapForm() {
  const { t } = usePreferences();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      organizationName: String(formData.get('organizationName') ?? ''),
      organizationSlug: String(formData.get('organizationSlug') ?? ''),
      projectName: String(formData.get('projectName') ?? ''),
      projectSlug: String(formData.get('projectSlug') ?? ''),
    };

    try {
      const response = await fetch('/api/v1/bootstrap', {
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
        BootstrapResponse | { error?: { message?: string } };

      if (!response.ok) {
        setError(
          (body as { error?: { message?: string } }).error?.message ??
            t('wsWorkspaceInitFailed'),
        );
        return;
      }

      window.location.assign('/app');
    } catch {
      setError(t('wsWorkspaceInitFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>
        {t('wsOrganizationName')}
        <input name="organizationName" type="text" required />
      </label>
      <label>
        {t('wsOrganizationSlug')}
        <input
          name="organizationSlug"
          type="text"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          required
        />
      </label>
      <label>
        {t('wsProjectName')}
        <input name="projectName" type="text" required />
      </label>
      <label>
        {t('wsProjectSlug')}
        <input
          name="projectSlug"
          type="text"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          required
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? t('wsCreatingWorkspace') : t('wsCreateWorkspace')}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
