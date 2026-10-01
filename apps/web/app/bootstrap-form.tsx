'use client';

import { FormEvent, useState } from 'react';

import { handleUnauthorizedResponse } from './session-recovery';

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
            'The workspace could not be initialized.',
        );
        return;
      }

      window.location.assign('/app');
    } catch {
      setError('The workspace could not be initialized.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>
        Organization name
        <input name="organizationName" type="text" required />
      </label>
      <label>
        Organization slug
        <input
          name="organizationSlug"
          type="text"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          required
        />
      </label>
      <label>
        Initial project name
        <input name="projectName" type="text" required />
      </label>
      <label>
        Initial project slug
        <input
          name="projectSlug"
          type="text"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          required
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Creating workspace...' : 'Create workspace'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
