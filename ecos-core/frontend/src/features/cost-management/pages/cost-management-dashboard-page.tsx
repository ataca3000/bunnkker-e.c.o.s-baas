import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  Clock,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { costDashboardService } from '@/features/cost-management/services/pricing-review-service';
import type { CostDashboardStats } from '@/features/cost-management/types/pricing-review';
import { ROUTES } from '@/router/routes';

function KpiCard({
  label,
  value,
  icon: Icon,
  description,
  onClick,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  onClick?: () => void;
  variant?: 'default' | 'warning' | 'success' | 'info';
}) {
  const variantClasses = {
    default: 'border-border',
    warning: 'border-amber-500/40 bg-amber-500/5',
    success: 'border-green-500/40 bg-green-500/5',
    info:    'border-blue-500/40 bg-blue-500/5',
  };

  const iconClasses = {
    default: 'text-muted-foreground',
    warning: 'text-amber-500',
    success: 'text-green-500',
    info:    'text-blue-500',
  };

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
      className={`rounded-lg border p-4 ${variantClasses[variant]} ${onClick ? 'cursor-pointer hover:bg-muted/40 transition-colors' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        <Icon className={`size-5 ${iconClasses[variant]}`} />
      </div>
    </div>
  );
}

export function CostManagementDashboardPage() {
  const navigate  = useNavigate();
  const { t } = useTranslation('cost-management');
  const [stats, setStats]     = useState<CostDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    costDashboardService.getStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number | null | undefined, decimals = 0) =>
    n == null ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="size-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">{t($ => $.dashboard.title)}</h1>
          <p className="text-sm text-muted-foreground">
            {t($ => $.dashboard.subtitle)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/30" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label={t($ => $.dashboard.kpi.pendingReviews.label)}
            value={fmt(stats?.pending_reviews)}
            icon={Clock}
            description={t($ => $.dashboard.kpi.pendingReviews.description)}
            onClick={() => navigate(ROUTES.costManagementPriceReview)}
            variant={stats && stats.pending_reviews > 0 ? 'warning' : 'default'}
          />
          <KpiCard
            label={t($ => $.dashboard.kpi.belowTargetMargin.label)}
            value={fmt(stats?.below_target_margin)}
            icon={AlertTriangle}
            description={t($ => $.dashboard.kpi.belowTargetMargin.description)}
            onClick={() => navigate(ROUTES.costManagementPriceReview)}
            variant={stats && stats.below_target_margin > 0 ? 'warning' : 'success'}
          />
          <KpiCard
            label={t($ => $.dashboard.kpi.costsIncreasedToday.label)}
            value={fmt(stats?.cost_increased_today)}
            icon={TrendingUp}
            description={t($ => $.dashboard.kpi.costsIncreasedToday.description)}
            onClick={() => navigate(ROUTES.costManagementCostHistory)}
            variant={stats && stats.cost_increased_today > 0 ? 'warning' : 'default'}
          />
          <KpiCard
            label={t($ => $.dashboard.kpi.costsDecreasedToday.label)}
            value={fmt(stats?.cost_decreased_today)}
            icon={TrendingDown}
            description={t($ => $.dashboard.kpi.costsDecreasedToday.description)}
            onClick={() => navigate(ROUTES.costManagementCostHistory)}
            variant={stats && stats.cost_decreased_today > 0 ? 'success' : 'default'}
          />
          <KpiCard
            label={t($ => $.dashboard.kpi.expectedProfitImpact.label)}
            value={fmt(stats?.expected_profit_impact, 2)}
            icon={stats && stats.expected_profit_impact >= 0 ? ArrowUp : ArrowDown}
            description={t($ => $.dashboard.kpi.expectedProfitImpact.description)}
            variant="info"
          />
          <KpiCard
            label={t($ => $.dashboard.kpi.averageMargin.label)}
            value={stats?.average_margin != null ? `${fmt(stats.average_margin, 1)}%` : '—'}
            icon={BarChart3}
            description={t($ => $.dashboard.kpi.averageMargin.description)}
          />
          <KpiCard
            label={t($ => $.dashboard.kpi.awaitingApproval.label)}
            value={fmt(stats?.awaiting_approval)}
            icon={CheckCircle2}
            description={t($ => $.dashboard.kpi.awaitingApproval.description)}
            onClick={() => navigate(ROUTES.costManagementPriceReview)}
            variant={stats && stats.awaiting_approval > 0 ? 'info' : 'default'}
          />
        </div>
      )}

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={() => navigate(ROUTES.costManagementPriceReview)}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted/40 transition-colors"
        >
          {t($ => $.dashboard.actions.pricingReviewCenter)}
        </button>
        <button
          type="button"
          onClick={() => navigate(ROUTES.costManagementCostHistory)}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted/40 transition-colors"
        >
          {t($ => $.dashboard.actions.viewCostHistory)}
        </button>
      </div>
    </div>
  );
}
