import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  PackageOpen,
  Plus,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
  Truck,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { usePurchaseMaterialStats } from '@/features/purchase-materials/hooks/use-purchase-materials';
import { useSupplierReturnStats } from '@/features/supplier-returns/hooks/use-supplier-returns';
import { useSupplierInvoiceStats } from '@/features/supplier-invoices/hooks/use-supplier-invoices';
import { ROUTES } from '@/router/routes';
import { useFormatter } from '@/hooks/use-formatter';

type KpiCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';
  icon: React.ElementType;
};

function KpiCard({ label, value, sub, color = 'blue', icon: Icon }: KpiCardProps) {
  const colorMap = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red:    'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <Card className="border border-gray-200 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${colorMap[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type QuickActionProps = {
  label: string;
  description: string;
  icon: React.ElementType;
  shortcut?: string;
  onClick: () => void;
  variant?: 'primary' | 'default';
};

function QuickAction({ label, description, icon: Icon, shortcut, onClick, variant = 'default' }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-start p-3 rounded-lg border transition-all hover:shadow-sm ${
        variant === 'primary'
          ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
          : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded-md flex-shrink-0 ${variant === 'primary' ? 'bg-blue-100' : 'bg-gray-100'}`}>
          <Icon className={`w-4 h-4 ${variant === 'primary' ? 'text-blue-600' : 'text-gray-500'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-medium ${variant === 'primary' ? 'text-blue-900' : 'text-gray-900'}`}>{label}</p>
            {shortcut && (
              <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 text-gray-500 border border-gray-200 rounded">
                {shortcut}
              </kbd>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{description}</p>
        </div>
      </div>
    </button>
  );
}

type AlertItemProps = {
  level: 'error' | 'warning' | 'info';
  title: string;
  description: string;
};

function AlertItem({ level, title, description }: AlertItemProps) {
  const map = {
    error:   { icon: AlertTriangle, class: 'text-red-500', bg: 'bg-red-50 border-red-200' },
    warning: { icon: Clock,         class: 'text-yellow-500', bg: 'bg-yellow-50 border-yellow-200' },
    info:    { icon: CheckCircle2,  class: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' },
  };
  const { icon: Icon, class: cls, bg } = map[level];

  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-lg border ${bg}`}>
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cls}`} />
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export function ProcurementHubPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('procurement');
  const fmt = useFormatter();
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const { data: pmStats, isLoading: pmLoading } = usePurchaseMaterialStats();
  const { data: returnStats } = useSupplierReturnStats();
  const { data: invoiceStats } = useSupplierInvoiceStats();

  const alerts = useMemo(() => {
    const list: AlertItemProps[] = [];

    if (pmStats) {
      if ((pmStats.operational?.approved ?? 0) > 0) {
        list.push({
          level: 'warning',
          title: tAny('hub.alertMessages.awaitingApproval', { count: pmStats.operational.approved }),
          description: t($ => $.hub.alertMessages.awaitingApprovalDesc),
        });
      }
      if ((pmStats.operational?.under_review ?? 0) > 0) {
        list.push({
          level: 'info',
          title: tAny('hub.alertMessages.underReview', { count: pmStats.operational.under_review }),
          description: t($ => $.hub.alertMessages.underReviewDesc),
        });
      }
    }

    if (returnStats && returnStats.waiting > 0) {
      list.push({
        level: 'warning',
        title: tAny('hub.alertMessages.returnsNeedApproval', { count: returnStats.waiting }),
        description: t($ => $.hub.alertMessages.returnsNeedApprovalDesc),
      });
    }

    if (invoiceStats && invoiceStats.failed > 0) {
      list.push({
        level: 'error',
        title: tAny('hub.alertMessages.invoicesFailed', { count: invoiceStats.failed }),
        description: t($ => $.hub.alertMessages.invoicesFailedDesc),
      });
    }

    if (returnStats && returnStats.credit_pending > 0) {
      list.push({
        level: 'info',
        title: tAny('hub.alertMessages.creditPending', { count: returnStats.credit_pending }),
        description: t($ => $.hub.alertMessages.creditPendingDesc),
      });
    }

    return list;
  }, [pmStats, returnStats, invoiceStats, t, tAny]);

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{t($ => $.hub.title)}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t($ => $.hub.subtitle)}</p>
          </div>
          <Button onClick={() => navigate(ROUTES.purchases)} size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            {t($ => $.hub.newPurchase)}
          </Button>
        </div>

        {/* Work Queue — top strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => navigate(`${ROUTES.materialRequests}?status=submitted`)}
            className="p-4 bg-white rounded-lg border border-gray-200 text-start hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <ClipboardList className="w-4 h-4 text-blue-500" />
              <Badge variant="secondary" className="text-xs">{pmLoading ? '…' : (pmStats?.operational?.under_review ?? 0)}</Badge>
            </div>
            <p className="text-sm font-medium text-gray-900">{t($ => $.hub.workQueue.materialRequests)}</p>
            <p className="text-xs text-gray-400">{t($ => $.hub.workQueue.awaitingAction)}</p>
          </button>

          <button
            onClick={() => navigate(`${ROUTES.purchases}?status=pending_approval`)}
            className="p-4 bg-white rounded-lg border border-gray-200 text-start hover:border-amber-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <ShoppingCart className="w-4 h-4 text-amber-500" />
              <Badge variant="secondary" className="text-xs">{pmLoading ? '…' : (pmStats?.operational?.approved ?? 0)}</Badge>
            </div>
            <p className="text-sm font-medium text-gray-900">{t($ => $.hub.workQueue.purchases)}</p>
            <p className="text-xs text-gray-400">{t($ => $.hub.workQueue.pendingApproval)}</p>
          </button>

          <button
            onClick={() => navigate(ROUTES.receivingCenter)}
            className="p-4 bg-white rounded-lg border border-gray-200 text-start hover:border-green-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <PackageOpen className="w-4 h-4 text-green-500" />
              <Badge variant="secondary" className="text-xs">—</Badge>
            </div>
            <p className="text-sm font-medium text-gray-900">{t($ => $.hub.workQueue.receiving)}</p>
            <p className="text-xs text-gray-400">{t($ => $.hub.workQueue.goodsToReceive)}</p>
          </button>

          <button
            onClick={() => navigate(`${ROUTES.supplierReturns}?status=waiting_approval`)}
            className="p-4 bg-white rounded-lg border border-gray-200 text-start hover:border-red-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <RotateCcw className="w-4 h-4 text-red-400" />
              <Badge variant="secondary" className="text-xs">{returnStats?.waiting ?? '—'}</Badge>
            </div>
            <p className="text-sm font-medium text-gray-900">{t($ => $.hub.workQueue.returns)}</p>
            <p className="text-xs text-gray-400">{t($ => $.hub.workQueue.waitingApproval)}</p>
          </button>
        </div>

        {/* Main 3-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column — KPIs + Alerts */}
          <div className="lg:col-span-2 space-y-6">

            {/* KPI Cards */}
            <div>
              <h2 className="text-sm font-medium text-gray-700 mb-3">{t($ => $.hub.financialOverview)}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard
                  label={t($ => $.hub.kpis.approvedPurchases)}
                  value={pmStats ? `${pmStats.operational?.approved ?? 0}` : '—'}
                  sub={t($ => $.hub.kpis.readyToExecute)}
                  icon={ShoppingCart}
                  color="blue"
                />
                <KpiCard
                  label={t($ => $.hub.kpis.invoiceValuePosted)}
                  value={invoiceStats ? fmt.moneyCompact(invoiceStats.total_value) : '—'}
                  sub={t($ => $.hub.kpis.thisPeriod)}
                  icon={DollarSign}
                  color="green"
                />
                <KpiCard
                  label={t($ => $.hub.kpis.pendingInvoiceValue)}
                  value={invoiceStats ? fmt.moneyCompact(invoiceStats.pending_value) : '—'}
                  sub={t($ => $.hub.kpis.draftValidated)}
                  icon={FileText}
                  color="yellow"
                />
                <KpiCard
                  label={t($ => $.hub.kpis.returnsValue)}
                  value={returnStats ? fmt.moneyCompact(returnStats.total_value) : '—'}
                  sub={t($ => $.hub.kpis.activeReturns)}
                  icon={RotateCcw}
                  color="red"
                />
              </div>
            </div>

            {/* Alerts */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-700">{t($ => $.hub.alertsTitle)}</h2>
                {alerts.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{alerts.length}</Badge>
                )}
              </div>
              {alerts.length === 0 ? (
                <div className="p-6 bg-white border border-gray-200 rounded-lg text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">{t($ => $.hub.noAlerts)}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert, i) => (
                    <AlertItem key={i} {...alert} />
                  ))}
                </div>
              )}
            </div>

            {/* Module Status Cards */}
            <div>
              <h2 className="text-sm font-medium text-gray-700 mb-3">{t($ => $.hub.moduleStatus)}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                <Card className="border border-gray-200 shadow-none">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      {t($ => $.hub.supplierInvoicesModule)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t($ => $.hub.invoiceStatus.draft)}</span>
                        <span className="font-medium">{invoiceStats?.draft ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t($ => $.hub.invoiceStatus.validatedReady)}</span>
                        <span className="font-medium text-blue-600">{invoiceStats?.validated ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t($ => $.hub.invoiceStatus.posted)}</span>
                        <span className="font-medium text-green-600">{invoiceStats?.posted ?? '—'}</span>
                      </div>
                      <Separator className="my-1.5" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs gap-1"
                        onClick={() => navigate(ROUTES.supplierInvoices)}
                      >
                        {t($ => $.hub.invoiceStatus.viewAll)} <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-gray-200 shadow-none">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-orange-500" />
                      {t($ => $.hub.supplierReturnsModule)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t($ => $.hub.returnStatus.draft)}</span>
                        <span className="font-medium">{returnStats?.draft ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t($ => $.hub.returnStatus.waitingApproval)}</span>
                        <span className="font-medium text-yellow-600">{returnStats?.waiting ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t($ => $.hub.returnStatus.creditPending)}</span>
                        <span className="font-medium text-orange-600">{returnStats?.credit_pending ?? '—'}</span>
                      </div>
                      <Separator className="my-1.5" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs gap-1"
                        onClick={() => navigate(ROUTES.supplierReturns)}
                      >
                        {t($ => $.hub.returnStatus.viewAll)} <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Right column — Quick Actions + Performance */}
          <div className="space-y-6">

            {/* Quick Actions */}
            <div>
              <h2 className="text-sm font-medium text-gray-700 mb-3">{t($ => $.hub.quickActions)}</h2>
              <div className="space-y-2">
                <QuickAction
                  variant="primary"
                  label={t($ => $.hub.actions2.newSupplierInvoice)}
                  description={t($ => $.hub.actions2.newSupplierInvoiceDesc)}
                  icon={Zap}
                  shortcut="I"
                  onClick={() => navigate(ROUTES.supplierInvoices)}
                />
                <QuickAction
                  label={t($ => $.hub.actions2.newMaterialRequest)}
                  description={t($ => $.hub.actions2.newMaterialRequestDesc)}
                  icon={ClipboardList}
                  shortcut="M"
                  onClick={() => navigate(ROUTES.materialRequests)}
                />
                <QuickAction
                  label={t($ => $.hub.actions2.newPurchase)}
                  description={t($ => $.hub.actions2.newPurchaseDesc)}
                  icon={ShoppingCart}
                  shortcut="P"
                  onClick={() => navigate(ROUTES.purchases)}
                />
                <QuickAction
                  label={t($ => $.hub.actions2.receiveGoods)}
                  description={t($ => $.hub.actions2.receiveGoodsDesc)}
                  icon={PackageOpen}
                  onClick={() => navigate(ROUTES.receivingCenter)}
                />
                <QuickAction
                  label={t($ => $.hub.actions2.newSupplierReturn)}
                  description={t($ => $.hub.actions2.newSupplierReturnDesc)}
                  icon={RotateCcw}
                  onClick={() => navigate(ROUTES.supplierReturns)}
                />
                <QuickAction
                  label={t($ => $.hub.actions2.supplierDirectory)}
                  description={t($ => $.hub.actions2.supplierDirectoryDesc)}
                  icon={Truck}
                  onClick={() => navigate(ROUTES.suppliers)}
                />
              </div>
            </div>

            {/* Performance snapshot */}
            <div>
              <h2 className="text-sm font-medium text-gray-700 mb-3">{t($ => $.hub.performance.title)}</h2>
              <Card className="border border-gray-200 shadow-none">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-gray-700">{t($ => $.hub.performance.totalPurchases)}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{pmStats ? (pmStats.operational?.draft ?? 0) + (pmStats.operational?.under_review ?? 0) + (pmStats.operational?.approved ?? 0) : '—'}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-500" />
                      <span className="text-xs text-gray-700">{t($ => $.hub.performance.approved)}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{pmStats?.operational?.approved ?? '—'}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-500" />
                      <span className="text-xs text-gray-700">{t($ => $.hub.performance.invoicesPosted)}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{invoiceStats?.posted ?? '—'}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-red-400" />
                      <span className="text-xs text-gray-700">{t($ => $.hub.performance.returnsCompleted)}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{returnStats?.completed ?? '—'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
