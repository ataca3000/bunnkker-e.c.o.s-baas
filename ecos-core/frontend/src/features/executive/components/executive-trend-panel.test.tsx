// Brings the toBeInTheDocument matcher's TYPE augmentation with it. test-setup.ts
// registers the matchers at runtime, but it is outside tsconfig.app.json, so the
// types are not visible to a type-check that roots at this file.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// useFormatter reaches for LanguageProvider context. Stubbing it keeps these
// assertions about WHAT is rendered rather than about the active locale's
// number formatting, which is covered by the formatter's own tests.
vi.mock('@/hooks/use-formatter', () => ({
  useFormatter: () => ({
    number: (v: number) => String(v),
    percent: (v: number) => `${v}%`,
    money: (v: number) => String(v),
  }),
}));

import { ExecutiveTrendPanel } from './executive-trend-panel';
import { toTrends } from '../lib/normalize';

/** The same envelope `GET /finance/intelligence/trends` returns. */
const PAYLOAD = {
  revenue: {
    series: [
      { month: '2026-01', value: 1000 },
      { month: '2026-03', value: 1200 },
    ],
    last: 1200,
    change_pct: 20,
    direction: 'up',
    explanation: 'revenue moved from 1000 to 1200 (20%) over 3 months.',
  },
  expense: {
    series: [{ month: '2026-01', value: 800 }],
    last: 800,
    change_pct: 0,
    direction: 'flat',
    explanation: 'expense moved from 800 to 800 (0%) over 1 months.',
  },
};

const LABEL: Record<string, string> = { revenue: 'Revenue', expense: 'Expense' };

const withLabels = (raw: unknown) =>
  toTrends(raw).map((s) => ({ ...s, label: LABEL[s.id] ?? s.id }));

// The panel takes already-translated text, so these stand in for what the page
// resolves via t(). They are test doubles, not UI copy.
const TEXT = [
  'Trends',
  'No trend data for this period.',
  'You do not have permission to view this section.',
  'This data is not available right now.',
] as const;

const props = {
  title: TEXT[0],
  empty: TEXT[1],
  restricted: TEXT[2],
  unavailable: TEXT[3],
};

describe('ExecutiveTrendPanel', () => {
  it('renders a row per series with the server explanation', () => {
    render(<ExecutiveTrendPanel {...props} series={withLabels(PAYLOAD)} />);

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Expense')).toBeInTheDocument();
    expect(screen.getByText(PAYLOAD.revenue.explanation)).toBeInTheDocument();
    // The month endpoints come straight from the payload. '2026-01' opens both
    // rows (and closes the single-point expense row), so match on all of them.
    expect(screen.getAllByText('2026-01').length).toBeGreaterThan(0);
    expect(screen.getByText('2026-03')).toBeInTheDocument();
  });

  it('draws one sparkline path per series', () => {
    const { container } = render(
      <ExecutiveTrendPanel {...props} series={withLabels(PAYLOAD)} />,
    );

    // role="img" scopes this to the sparklines — the direction icons are svgs too.
    const paths = container.querySelectorAll('svg[role="img"] path');
    expect(paths).toHaveLength(2);
    // Every point the server sent is plotted — nothing interpolated or dropped.
    expect(paths[0].getAttribute('d')?.match(/[ML]/g)).toHaveLength(2);
  });

  it('shows the empty state instead of a blank card when nothing came back', () => {
    render(<ExecutiveTrendPanel {...props} series={[]} />);

    expect(screen.getByText(props.empty)).toBeInTheDocument();
  });

  it('shows a restricted state without rendering any series', () => {
    render(<ExecutiveTrendPanel {...props} series={withLabels(PAYLOAD)} isRestricted />);

    expect(screen.getByText(props.restricted)).toBeInTheDocument();
    expect(screen.queryByText('Revenue')).not.toBeInTheDocument();
  });

  it('shows an unavailable state on error', () => {
    render(<ExecutiveTrendPanel {...props} series={[]} isError />);

    expect(screen.getByText(props.unavailable)).toBeInTheDocument();
  });
});
