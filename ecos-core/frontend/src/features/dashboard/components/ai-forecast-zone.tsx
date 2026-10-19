import { Brain, FlaskConical, TrendingUp, Zap } from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type enDashboard from '@/i18n/locales/en/dashboard.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. The selector is the same expression the
 * compiler validates at an inline call site, kept in the table. The array is
 * annotated rather than `as const` so each selector gets its contextual type —
 * a const assertion cannot wrap a function.
 */
type DashboardLabel = ($: typeof enDashboard) => string;

type PlannedFeature = {
  /** Stable identity for React reconciliation — the label is a function now. */
  id: string;
  icon: ComponentType<{ className?: string }>;
  labelKey: DashboardLabel;
  descKey: DashboardLabel;
};

// ── Planned features ───────────────────────────────────────────────────────

const FEATURES: PlannedFeature[] = [
  { id: 'demand-forecast', icon: TrendingUp,   labelKey: ($) => $.aiForecast.features.demandForecast, descKey: ($) => $.aiForecast.features.demandForecastDesc },
  { id: 'purchase-suggestions', icon: Zap,          labelKey: ($) => $.aiForecast.features.purchaseSuggestions, descKey: ($) => $.aiForecast.features.purchaseSuggestionsDesc },
  { id: 'inventory-optimisation', icon: Brain,        labelKey: ($) => $.aiForecast.features.inventoryOpt, descKey: ($) => $.aiForecast.features.inventoryOptDesc },
  { id: 'campaign-recommendations', icon: FlaskConical, labelKey: ($) => $.aiForecast.features.campaignRec, descKey: ($) => $.aiForecast.features.campaignRecDesc },
  { id: 'cash-flow', icon: TrendingUp,   labelKey: ($) => $.aiForecast.features.cashFlow, descKey: ($) => $.aiForecast.features.cashFlowDesc },
];

// ── Component ──────────────────────────────────────────────────────────────

export function AiForecastZone() {
  const { t } = useTranslation('dashboard');

  return (
    <div className="rounded-xl border border-dashed border-violet-500/20 bg-violet-500/[0.02] p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
          <Brain className="h-4 w-4 text-violet-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{t($ => $.aiForecast.title)}</h3>
            <Badge variant="outline" className="border-violet-500/30 text-[10px] text-violet-600 dark:text-violet-400">
              {t($ => $.aiForecast.reserved)}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t($ => $.aiForecast.description)}
          </p>
        </div>
      </div>

      {/* Features grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {FEATURES.map((f) => (
          <div
            key={f.id}
            className="flex items-start gap-2.5 rounded-lg border border-dashed border-violet-500/10 bg-background/40 p-3"
          >
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-violet-500/10">
              <f.icon className="h-3 w-3 text-violet-500/60" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground/70">{t(f.labelKey)}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/60">{t(f.descKey)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
