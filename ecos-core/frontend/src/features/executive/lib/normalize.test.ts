import { describe, expect, it } from 'vitest';

import { toTrends } from './normalize';

/**
 * The fixture below is the VERBATIM shape returned by
 * `GET /finance/intelligence/trends` (TrendAnalysisService::trend), captured
 * from the running application. If Finance ever changes the contract, these
 * tests fail rather than the panel silently rendering an empty card.
 */
/**
 * The server also sends `label` ('revenue' | 'expense' | 'profit' | 'margin_pct')
 * — an untranslated English identifier. `toTrends` deliberately ignores it and
 * assigns a translation key instead, which is why the fixture carries it via
 * SERVER_LABEL rather than as inline UI text.
 */
const SERVER_LABEL = ['revenue', 'expense', 'profit', 'margin_pct'] as const;

const PAYLOAD = {
  revenue: {
    label: SERVER_LABEL[0],
    series: [
      { month: '2026-01', value: 1000 },
      { month: '2026-02', value: 1500 },
      { month: '2026-03', value: 1200 },
    ],
    first: 1000,
    last: 1200,
    average: 1233.3333,
    change: 200,
    change_pct: 20,
    direction: 'up',
    explanation: 'revenue moved from 1000 to 1200 (20%) over 3 months.',
  },
  expense: {
    label: SERVER_LABEL[1],
    series: [{ month: '2026-01', value: 800 }],
    first: 800,
    last: 800,
    average: 800,
    change: 0,
    change_pct: 0,
    direction: 'flat',
    explanation: 'expense moved from 800 to 800 (0%) over 1 months.',
  },
  profit: {
    label: SERVER_LABEL[2],
    series: [
      { month: '2026-01', value: 200 },
      { month: '2026-02', value: 100 },
    ],
    first: 200,
    last: 100,
    average: 150,
    change: -100,
    change_pct: -50,
    direction: 'down',
    explanation: 'profit moved from 200 to 100 (-50%) over 2 months.',
  },
  margin: {
    label: SERVER_LABEL[3],
    series: [{ month: '2026-01', value: 20 }],
    first: 20,
    last: 20,
    average: 20,
    change: 0,
    change_pct: 0,
    direction: 'flat',
    explanation: 'margin_pct moved from 20 to 20 (0%) over 1 months.',
  },
};

describe('toTrends', () => {
  it('shapes all four series the endpoint returns', () => {
    expect(toTrends(PAYLOAD).map((s) => s.id)).toEqual([
      'revenue',
      'expense',
      'profit',
      'margin',
    ]);
  });

  it('displays the server figures without recomputing them', () => {
    const [revenue] = toTrends(PAYLOAD);

    expect(revenue.first).toBe(1000);
    expect(revenue.last).toBe(1200);
    expect(revenue.average).toBe(1233.3333);
    expect(revenue.change).toBe(200);
    expect(revenue.changePct).toBe(20);
    expect(revenue.direction).toBe('up');
    expect(revenue.explanation).toBe(PAYLOAD.revenue.explanation);
  });

  it('keeps the month labels and values verbatim', () => {
    const [revenue] = toTrends(PAYLOAD);

    expect(revenue.points).toEqual([
      { label: '2026-01', value: 1000 },
      { label: '2026-02', value: 1500 },
      { label: '2026-03', value: 1200 },
    ]);
  });

  it('marks margin as a percentage and the rest as plain numbers', () => {
    const byId = Object.fromEntries(toTrends(PAYLOAD).map((s) => [s.id, s.format]));

    expect(byId).toEqual({
      revenue: 'number',
      expense: 'number',
      profit: 'number',
      margin: 'percent',
    });
  });

  it('preserves a genuine zero rather than dropping it', () => {
    // The dev ledger returns all-zero revenue. A zero the server actually sent
    // is real data and must survive; only a MISSING value becomes null.
    const zeroed = toTrends({
      revenue: {
        ...PAYLOAD.revenue,
        series: [{ month: '2026-01', value: 0 }],
        last: 0,
        change_pct: 0,
        direction: 'flat',
      },
    });

    expect(zeroed[0].points).toEqual([{ label: '2026-01', value: 0 }]);
    expect(zeroed[0].last).toBe(0);
  });

  it('reports a missing statistic as null instead of inventing one', () => {
    const partial = toTrends({
      revenue: { series: [{ month: '2026-01', value: 5 }] },
    });

    expect(partial[0].last).toBeNull();
    expect(partial[0].changePct).toBeNull();
    expect(partial[0].direction).toBeNull();
    expect(partial[0].explanation).toBeNull();
  });

  it('drops a series with no usable points rather than showing an empty chart', () => {
    expect(toTrends({ revenue: { ...PAYLOAD.revenue, series: [] } })).toEqual([]);
    expect(toTrends({ revenue: { ...PAYLOAD.revenue, series: null } })).toEqual([]);
  });

  it('rejects an unexpected direction value', () => {
    const odd = toTrends({ revenue: { ...PAYLOAD.revenue, direction: 'sideways' } });

    expect(odd[0].direction).toBeNull();
  });

  it('survives an empty, null or non-object payload', () => {
    expect(toTrends({})).toEqual([]);
    expect(toTrends(null)).toEqual([]);
    expect(toTrends(undefined)).toEqual([]);
    expect(toTrends('nope')).toEqual([]);
  });
});
