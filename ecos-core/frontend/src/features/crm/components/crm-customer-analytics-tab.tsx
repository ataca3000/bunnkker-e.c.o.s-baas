import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import type { CrmCustomerIntelligence, CrmRiskBand } from '@/features/crm/types/crm-customer';
import type enCrm from '@/i18n/locales/en/crm.json';

/**
 * Customer analytics — the intelligence engine's view of one customer.
 *
 * Every figure shown here is computed and stored by the backend. Nothing is
 * derived in the client: a churn score recalculated in the browser would drift
 * from the one the rest of the platform reports.
 *
 * The orders section is a SUMMARY, not a list. The intelligence profile carries
 * order count, total spent, average value and first/last dates; there is no
 * customer-scoped orders endpoint, so a per-order list is not offered and the
 * section says why rather than appearing incomplete.
 */

type CrmLabel = ($: typeof enCrm) => string;

/** Risk bands map to the muted/accent palette rather than raw colours. */
const BAND_CLASS: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  critical: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

const BAND_LABEL: Record<string, CrmLabel> = {
  low: ($) => $.analytics.risk.band.low,
  medium: ($) => $.analytics.risk.band.medium,
  high: ($) => $.analytics.risk.band.high,
  critical: ($) => $.analytics.risk.band.critical,
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <p className="py-4 text-sm text-muted-foreground">{message}</p>;
}

/** Amounts arrive as decimal strings; formatted for the active locale. */
function useMoney() {
  const { i18n } = useTranslation();
  return (value: string | number | null | undefined) =>
    value === null || value === undefined
      ? '—'
      : new Intl.NumberFormat(i18n.language).format(Number(value));
}

function formatDate(value: string | null, language: string): string {
  return value ? new Date(value).toLocaleDateString(language) : '—';
}

export function CrmCustomerAnalyticsTab({
  data,
  isLoading,
}: {
  data: CrmCustomerIntelligence | undefined;
  isLoading: boolean;
}) {
  const { t, i18n } = useTranslation('crm');
  const money = useMoney();

  if (isLoading) return <Empty message={t(($) => $.analytics.loading)} />;

  // The engine computes profiles on a schedule, so a customer can legitimately
  // have none yet. That is a real state, not an error.
  if (!data?.profile) return <Empty message={t(($) => $.analytics.notComputed)} />;

  const p = data.profile;
  const band = (value: CrmRiskBand): ReactNode => (
    <Badge className={BAND_CLASS[value] ?? ''} variant="secondary">
      {BAND_LABEL[value] ? t(BAND_LABEL[value]) : value}
    </Badge>
  );

  return (
    <div className="flex flex-col gap-6">
      <Section title={t(($) => $.analytics.sections.risk)}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat
            label={t(($) => $.analytics.risk.churn)}
            value={
              <span className="flex items-center gap-2">
                {p.churn_risk_score} {band(p.churn_risk_band)}
              </span>
            }
          />
          <Stat
            label={t(($) => $.analytics.risk.health)}
            value={
              <span className="flex items-center gap-2">
                {p.health_score} {band(p.health_band)}
              </span>
            }
          />
          <Stat
            label={t(($) => $.analytics.risk.segment)}
            value={p.rfm_segment ?? p.segment ?? '—'}
          />
          <Stat label={t(($) => $.analytics.risk.lifecycle)} value={p.lifecycle_stage} />
        </div>
      </Section>

      <Section title={t(($) => $.analytics.sections.orders)}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat label={t(($) => $.analytics.orders.count)} value={p.frequency} />
          <Stat label={t(($) => $.analytics.orders.total)} value={money(p.monetary)} />
          <Stat
            label={t(($) => $.analytics.orders.average)}
            value={money(p.average_order_value)}
          />
          <Stat
            label={t(($) => $.analytics.orders.last)}
            value={formatDate(p.last_purchase_at, i18n.language)}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t(($) => $.analytics.orders.note)}</p>
      </Section>

      <Section title={t(($) => $.analytics.sections.stats)}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat label={t(($) => $.analytics.stats.lifetimeValue)} value={money(p.lifetime_value)} />
          <Stat
            label={t(($) => $.analytics.stats.predictedValue)}
            value={money(p.predicted_lifetime_value)}
          />
          <Stat
            label={t(($) => $.analytics.stats.tenure)}
            value={t(($) => $.analytics.stats.tenureDays, { count: p.tenure_days })}
          />
          <Stat label={t(($) => $.analytics.stats.recency)} value={p.recency_days ?? '—'} />
          <Stat
            label={t(($) => $.analytics.stats.repeat)}
            value={p.is_repeat ? t(($) => $.analytics.yes) : t(($) => $.analytics.no)}
          />
          <Stat
            label={t(($) => $.analytics.stats.retained)}
            value={p.is_retained ? t(($) => $.analytics.yes) : t(($) => $.analytics.no)}
          />
        </div>
      </Section>

      <Section title={t(($) => $.analytics.sections.insights)}>
        {data.insights.length === 0 ? (
          <Empty message={t(($) => $.analytics.insights.none)} />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.insights.map((insight) => (
              <li key={insight.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{insight.title}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {insight.severity}
                  </Badge>
                </div>
                {insight.detail && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{insight.detail}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t(($) => $.analytics.sections.recommendations)}>
        {data.recommendations.length === 0 ? (
          <Empty message={t(($) => $.analytics.recommendations.none)} />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.recommendations.map((rec) => (
              <li key={rec.id} className="rounded-md border p-3">
                <span className="text-sm font-medium">{rec.title}</span>
                {rec.rationale && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{rec.rationale}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {p.computed_at && (
        <p className="text-[11px] text-muted-foreground">
          {t(($) => $.analytics.computedAt, {
            when: new Date(p.computed_at).toLocaleString(i18n.language),
          })}
        </p>
      )}
    </div>
  );
}
