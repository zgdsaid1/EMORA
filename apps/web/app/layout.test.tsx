import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('./shell/application-shell', () => ({
  ApplicationShell: ({ children }: { children: React.ReactNode }) => children,
}));

import RootLayout from './layout';

describe('RootLayout locale SSR', () => {
  beforeEach(() => {
    cookiesMock.mockReset();
  });

  it.each([
    ['en', 'en', 'ltr'],
    ['fr', 'fr', 'ltr'],
    ['ar', 'ar', 'rtl'],
    ['invalid', 'en', 'ltr'],
    [undefined, 'en', 'ltr'],
  ] as const)(
    'renders cookie %s as lang=%s and dir=%s in server HTML',
    async (cookieValue, expectedLocale, expectedDirection) => {
      cookiesMock.mockResolvedValue({
        get: () =>
          cookieValue === undefined ? undefined : { value: cookieValue },
      });

      const html = await RootLayout({
        children: React.createElement('main', null, 'content'),
      });
      const markup = renderToStaticMarkup(html);

      expect(markup).toContain(
        `<html lang="${expectedLocale}" dir="${expectedDirection}"`,
      );
      expect(markup).toContain('<main>content</main>');
      expect(cookiesMock).toHaveBeenCalledOnce();
    },
  );
});
