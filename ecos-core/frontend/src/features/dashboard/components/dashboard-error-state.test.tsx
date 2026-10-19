// Brings the toBeInTheDocument matcher's TYPE augmentation with it. test-setup.ts
// registers the matchers at runtime, but it is outside tsconfig.app.json, so the
// types are not visible to a type-check that roots at this file.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-formatter', () => ({
  useFormatter: () => ({
    number: (v: number) => String(v),
    percent: (v: number) => `${v}%`,
    money: (v: number) => String(v),
    moneyCompact: (v: number) => String(v),
  }),
}));

// The components read their copy through t(); the identity stub returns the key
// path so assertions target the key, not a translation that may be reworded.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (selector: (src: Record<string, unknown>) => string) =>
      selector(
        new Proxy(
          {},
          {
            get: (_t, prop: string) =>
              new Proxy({} as Record<string, unknown>, {
                get: (_i, leaf: string) => `${prop}.${leaf}`,
              }),
          },
        ) as Record<string, unknown>,
      ),
    i18n: { language: 'en' },
  }),
}));

import { DashboardAiBrief } from './dashboard-ai-brief';
import { DashboardHeroStrip } from './dashboard-hero-strip';

/**
 * TASK-GL-HOTFIX-001 — the Dashboard must never sit in a loading skeleton after
 * a failed request.
 *
 * The original defect was not the SQL alone. `useExecutiveDashboard` exposes
 * `isError`, but the page destructured only `data` and `isLoading` — so on
 * failure `loading` was false, `data` was undefined, and both components fell
 * through to `loading || !data` and animated forever. A user could not tell a
 * broken endpoint from a slow one.
 *
 * These tests pin the three states apart, which is the property that was missing:
 * loading ≠ error, and error offers a way out.
 */
describe('Dashboard error state (TASK-GL-HOTFIX-001)', () => {
  describe('DashboardHeroStrip', () => {
    it('shows the unavailable message and a retry action when the fetch failed', () => {
      const onRetry = vi.fn();
      render(
        <DashboardHeroStrip
          data={undefined}
          loading={false}
          profile="executive"
          error
          onRetry={onRetry}
        />,
      );

      expect(screen.getByText('errors.unavailable')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /errors\.retry/ })).toBeInTheDocument();
    });

    it('calls onRetry when the retry action is used', async () => {
      const onRetry = vi.fn();
      render(
        <DashboardHeroStrip
          data={undefined}
          loading={false}
          profile="executive"
          error
          onRetry={onRetry}
        />,
      );

      screen.getByRole('button', { name: /errors\.retry/ }).click();
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('does NOT show the error state while genuinely loading', () => {
      render(<DashboardHeroStrip data={undefined} loading profile="executive" />);

      expect(screen.queryByText('errors.unavailable')).not.toBeInTheDocument();
    });
  });

  describe('DashboardAiBrief', () => {
    it('shows the unavailable message and a retry action when the fetch failed', () => {
      render(<DashboardAiBrief data={undefined} loading={false} error onRetry={vi.fn()} />);

      expect(screen.getByText('errors.unavailable')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /errors\.retry/ })).toBeInTheDocument();
    });

    it('does NOT show the error state while genuinely loading', () => {
      render(<DashboardAiBrief data={undefined} loading />);

      expect(screen.queryByText('errors.unavailable')).not.toBeInTheDocument();
    });
  });
});
