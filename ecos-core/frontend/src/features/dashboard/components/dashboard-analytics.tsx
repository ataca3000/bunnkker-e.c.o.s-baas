import { Brain, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { MonthlyProgress }  from './monthly-progress';
import type { ExecutiveDashboardData } from '../services/executive-dashboard.service';

import type enDashboard from '@/i18n/locales/en/dashboard.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. The selector is the same expression the
 * compiler validates at an inline call site, kept in the table.
 */
type DashboardLabel = ($: typeof enDashboard) => string;


// ── AI Reserved zone ───────────────────────────────────────────────────────

function AiReservedZone() {
  const { t } = useTranslation('dashboard');

  const AI_FEATURES: { id: string; labelKey: DashboardLabel; descKey: DashboardLabel }[] = [
    { id: 'demand-forecast', labelKey: ($) => $.analytics.features.demandForecast, descKey: ($) => $.analytics.features.demandForecastDesc },
    { id: 'purchase-suggestions', labelKey: ($) => $.analytics.features.purchaseSuggestions, descKey: ($) => $.analytics.features.purchaseSuggestionsDesc },
    { id: 'revenue-prediction', labelKey: ($) => $.analytics.features.revenuePrediction, descKey: ($) => $.analytics.features.revenuePredictionDesc },
    { id: 'campaign-recommendations', labelKey: ($) => $.analytics.features.campaignRec, descKey: ($) => $.analytics.features.campaignRecDesc },
    { id: 'cash-flow', labelKey: ($) => $.analytics.features.cashFlow, descKey: ($) => $.analytics.features.cashFlowDesc },
    { id: 'churn-risk', labelKey: ($) => $.analytics.features.churnRisk, descKey: ($) => $.analytics.features.churnRiskDesc },
    { id: 'inventory-optimisation', labelKey: ($) => $.analytics.features.inventoryOpt, descKey: ($) => $.analytics.features.inventoryOptDesc },
  ];

  return (
    <div className="rounded-xl border border-dashed border-violet-500/20 bg-violet-500/[0.02] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Brain className="h-4 w-4 text-violet-500" />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-400">
          {t($ => $.analytics.aiLayer)}
        </span>
        <Badge variant="outline" className="border-violet-500/30 text-[10px] text-violet-600 dark:text-violet-400">
          {t($ => $.analytics.aiPlanned)}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {AI_FEATURES.map((f) => (
          <div
            key={f.id}
            className="rounded-lg border border-dashed border-violet-500/15 bg-violet-500/[0.02] p-3 opacity-60"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="h-3 w-3 text-violet-400" />
              <p className="text-[11px] font-semibold text-foreground/70">{t(f.labelKey)}</p>
            </div>
            <p className="text-[10px] text-muted-foreground">{t(f.descKey)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  data?:    ExecutiveDashboardData;
  loading?: boolean;
}

export function DashboardAnalytics({ data, loading }: Props) {
  return (
    <div className="space-y-6">
      {/* Monthly progress */}
      <MonthlyProgress data={data?.monthly} loading={loading} />

      {/* AI reserved space */}
      <AiReservedZone />
    </div>
  );
}
