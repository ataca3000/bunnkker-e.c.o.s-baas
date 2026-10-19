import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Cog,
  History,
  Loader2,
  Package,
  RotateCcw,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Webhook,
  XCircle,
} from 'lucide-react';

import { Badge }    from '@/components/ui/badge';
import { useBrandQuery } from '@/features/brands/hooks/use-brands';

import { POLICY_GROUP_LABELS, type PolicyGroup } from '../types/configuration';
import {
  useBrandAudit,
  useHealthScore,
} from '../hooks/use-configuration';
import { PolicyWorkspace }                from '../components/policy-workspace';
import { DeliveryCoverageWorkspace }     from '../components/delivery-coverage-workspace';
import { DeliveryShippingWorkspace }     from '../components/delivery-shipping-workspace';
import type { ConfigHealthScore, ConfigAuditEntry } from '../types/configuration';

// ── Dashboard card definitions ─────────────────────────────────────────────────

type WorkspaceId =
  | 'preparation' | 'inventory' | 'manufacturing'
  | 'pricing' | 'order' | 'logistics' | 'crm' | 'marketing'
  | 'workflow' | 'notification' | 'security' | 'integration' | 'ai'
  | 'numbering' | 'approval' | 'audit' | 'windows';

type WorkspaceCard = {
  id:     WorkspaceId;
  icon:   React.ReactNode;
  /** Health check keys that determine this card's status */
  checks: (keyof ConfigHealthScore['checks'])[];
};

const OPERATIONS_CARDS: WorkspaceCard[] = [
  {
    id: 'preparation',
    icon: <Package className="h-5 w-5" />,
    checks: ['preparation_policy'],
  },
  {
    id: 'inventory',
    icon: <ClipboardList className="h-5 w-5" />,
    checks: ['inventory_policy'],
  },
  {
    id: 'manufacturing',
    icon: <Cog className="h-5 w-5" />,
    checks: ['manufacturing_policy'],
  },
];

const COMMERCE_CARDS: WorkspaceCard[] = [
  {
    id: 'logistics',
    icon: <Truck className="h-5 w-5" />,
    checks: [],
  },
  {
    id: 'crm',
    icon: <Users className="h-5 w-5" />,
    checks: [],
  },
  {
    id: 'marketing',
    icon: <Bot className="h-5 w-5" />,
    checks: [],
  },
];

const SYSTEM_CARDS: WorkspaceCard[] = [
  {
    id: 'workflow',
    icon: <RotateCcw className="h-5 w-5" />,
    checks: ['workflow_policy'],
  },
  {
    id: 'notification',
    icon: <Bot className="h-5 w-5" />,
    checks: [],
  },
  {
    id: 'security',
    icon: <ShieldCheck className="h-5 w-5" />,
    checks: [],
  },
  {
    id: 'integration',
    icon: <Webhook className="h-5 w-5" />,
    checks: ['integrations'],
  },
  {
    id: 'ai',
    icon: <Brain className="h-5 w-5" />,
    checks: ['ai_configuration'],
  },
  {
    id: 'numbering',
    icon: <Settings className="h-5 w-5" />,
    checks: [],
  },
  {
    id: 'approval',
    icon: <CheckCircle2 className="h-5 w-5" />,
    checks: [],
  },
  {
    id: 'audit',
    icon: <History className="h-5 w-5" />,
    checks: [],
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export function BrandConfigurationPage() {
  const { brandId }           = useParams<{ brandId: string }>();
  const navigate              = useNavigate();
  const [params, setParams]   = useSearchParams();
  const activeWorkspace       = (params.get('tab') ?? '') as WorkspaceId | '';
  const { t }                 = useTranslation('settings');

  const { data: brand }       = useBrandQuery(brandId ?? '');
  const { data: health }      = useHealthScore(brandId ?? null);

  if (!brandId) return null;

  function openWorkspace(id: WorkspaceId) {
    setParams({ tab: id }, { replace: true });
  }

  function closeToDashboard() {
    setParams({}, { replace: true });
  }

  // ── Workspace view ──
  if (activeWorkspace) {
    return (
      <WorkspaceView
        brandId={brandId}
        workspace={activeWorkspace}
        brandName={brand?.name}
        onBack={closeToDashboard}
      />
    );
  }

  // ── Dashboard view ──
  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 border-b border-border/60 flex items-center gap-3 sticky top-0 bg-background z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <h1 className="text-base font-semibold leading-none">{t($ => $.brandConfig.pageTitle as any)}</h1>
          {brand && (
            <p className="text-xs text-muted-foreground mt-0.5">{brand.name}</p>
          )}
        </div>
        {health && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t($ => $.brandConfig.health.scoreLabel)}</span>
            <span className={`text-sm font-bold ${
              health.score >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
              health.score >= 50 ? 'text-amber-600 dark:text-amber-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {health.score}%
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 p-6 space-y-6 max-w-5xl">

        {/* Configuration Health — Phase D */}
        <ConfigHealthPanel health={health} />

        {/* OPERATIONS section */}
        <DashboardSection
          label={t($ => $.brandConfig.sections.operations)}
          cards={OPERATIONS_CARDS}
          health={health}
          onOpen={openWorkspace}
        />

        {/* COMMERCE section */}
        <DashboardSection
          label={t($ => $.brandConfig.sections.commerce)}
          cards={COMMERCE_CARDS}
          health={health}
          onOpen={openWorkspace}
        />

        {/* SYSTEM section */}
        <DashboardSection
          label={t($ => $.brandConfig.sections.system)}
          cards={SYSTEM_CARDS}
          health={health}
          onOpen={openWorkspace}
        />
      </div>
    </div>
  );
}

// ── Config Health Panel ───────────────────────────────────────────────────────

function ConfigHealthPanel({ health }: { health: ConfigHealthScore | undefined }) {
  const { t } = useTranslation('settings');

  if (!health) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-5 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-3" />
        <div className="h-3 w-full bg-muted rounded" />
      </div>
    );
  }

  const color = health.score >= 80 ? 'bg-emerald-500'
    : health.score >= 50 ? 'bg-amber-500'
    : 'bg-red-500';

  const textColor = health.score >= 80 ? 'text-emerald-700 dark:text-emerald-400'
    : health.score >= 50 ? 'text-amber-700 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">{t($ => $.brandConfig.health.title)}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t($ => $.brandConfig.health.checksComplete, { passed: health.passed, total: health.total })}
          </p>
        </div>
        <span className={`text-3xl font-bold tabular-nums ${textColor}`}>
          {health.score}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${health.score}%` }}
        />
      </div>

      {/* Check grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5 pt-1">
        {(Object.entries(health.checks) as [keyof ConfigHealthScore['checks'], boolean][]).map(([key, ok]) => (
          <span
            key={key}
            className={`flex items-center gap-1.5 text-xs ${
              ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
            }`}
          >
            {ok
              ? <CheckCircle2 className="h-3 w-3 shrink-0" />
              : <XCircle      className="h-3 w-3 shrink-0 opacity-40" />
            }
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <span className={!ok ? 'opacity-60' : ''}>{t($ => $.brandConfig.checkLabels[key] as any)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard Section ─────────────────────────────────────────────────────────

function DashboardSection({
  label, cards, health, onOpen,
}: {
  label:   string;
  cards:   WorkspaceCard[];
  health:  ConfigHealthScore | undefined;
  onOpen:  (id: WorkspaceId) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className="flex-1 h-px bg-border/60" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card) => (
          <WorkspaceConfigCard
            key={card.id}
            card={card}
            health={health}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

// ── Workspace Config Card ─────────────────────────────────────────────────────

function WorkspaceConfigCard({
  card, health, onOpen,
}: {
  card:   WorkspaceCard;
  health: ConfigHealthScore | undefined;
  onOpen: (id: WorkspaceId) => void;
}) {
  const { t } = useTranslation('settings');

  // Compute card status from health checks
  let status: 'complete' | 'partial' | 'missing' | 'none' = 'none';
  if (health && card.checks.length > 0) {
    const checkValues = card.checks.map((k) => health.checks[k] ?? false);
    const passCount   = checkValues.filter(Boolean).length;
    if (passCount === checkValues.length)       status = 'complete';
    else if (passCount > 0)                     status = 'partial';
    else                                        status = 'missing';
  }

  return (
    <button
      onClick={() => onOpen(card.id)}
      className="group relative rounded-xl border border-border/60 bg-card p-4 text-start hover:border-primary/40 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          {card.icon}
        </div>
        {status === 'complete' && (
          <Badge className="text-[10px] py-0 h-5 bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
            {t($ => $.brandConfig.statusBadge.complete)}
          </Badge>
        )}
        {status === 'partial' && (
          <Badge className="text-[10px] py-0 h-5 bg-amber-50 text-amber-700 border-amber-200 shrink-0">
            {t($ => $.brandConfig.statusBadge.partial)}
          </Badge>
        )}
        {status === 'missing' && (
          <Badge className="text-[10px] py-0 h-5 bg-muted text-muted-foreground border-0 shrink-0">
            {t($ => $.brandConfig.statusBadge.notSet)}
          </Badge>
        )}
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <h3 className="text-sm font-semibold mb-0.5">{t($ => $.brandConfig.cards[card.id].label as any)}</h3>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <p className="text-xs text-muted-foreground line-clamp-2">{t($ => $.brandConfig.cards[card.id].desc as any)}</p>
      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="h-4 w-4 text-primary" />
      </div>
    </button>
  );
}

// ── Workspace View (inner page) ───────────────────────────────────────────────

const POLICY_GROUPS_SET = new Set<string>([
  'preparation', 'pricing', 'inventory', 'manufacturing', 'order',
  'logistics', 'crm', 'marketing', 'ai', 'workflow',
  'notification', 'integration', 'security', 'numbering', 'approval',
]);

function WorkspaceView({
  brandId,
  workspace,
  brandName,
  onBack,
}: {
  brandId:    string;
  workspace:  WorkspaceId;
  brandName?: string;
  onBack:     () => void;
}) {
  const { t } = useTranslation('settings');
  const tAny = t as (key: string) => string;
  const workspaceLabel =
    workspace === 'audit' ? t($ => $.brandConfig.auditLog) :
    (tAny(`brandConfig.cards.${workspace}.label`) || POLICY_GROUP_LABELS[workspace as PolicyGroup] || workspace);

  return (
    <div className="flex flex-col h-full">
      {/* Workspace header */}
      <div className="px-6 pt-4 pb-3 border-b border-border/60 flex items-center gap-3 sticky top-0 bg-background z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t($ => $.brandConfig.back)}
        </button>
        <div className="h-4 w-px bg-border/60" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold leading-none">{workspaceLabel}</h1>
          {brandName && (
            <p className="text-xs text-muted-foreground mt-0.5">{brandName}</p>
          )}
        </div>
      </div>

      {/* Workspace content */}
      <div className="flex-1 overflow-auto">
        {workspace === 'audit'             && <AuditWorkspace            brandId={brandId} />}
        {workspace === 'windows'           && <DeliveryWorkspaceTabs     brandId={brandId} />}
        {POLICY_GROUPS_SET.has(workspace)  && (
          <PolicyWorkspace brandId={brandId} group={workspace as PolicyGroup} />
        )}
      </div>
    </div>
  );
}

// ── Delivery Workspace Tabs ───────────────────────────────────────────────────

const DELIVERY_TABS: Array<'coverage' | 'shipping'> = ['coverage', 'shipping'];

function DeliveryWorkspaceTabs({ brandId }: { brandId: string }) {
  const { t } = useTranslation('settings');
  const tAny = t as (key: string) => string;
  const [tab, setTab] = useState<'coverage' | 'shipping'>('coverage');

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/60 px-6 flex gap-6 shrink-0">
        {DELIVERY_TABS.map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tAny(`brandConfig.deliveryWindowsTabs.${key}`)}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'coverage' && <DeliveryCoverageWorkspace brandId={brandId} />}
        {tab === 'shipping' && <DeliveryShippingWorkspace brandId={brandId} />}
      </div>
    </div>
  );
}

// ── Audit Workspace ───────────────────────────────────────────────────────────

function AuditWorkspace({ brandId }: { brandId: string }) {
  const { data: entries = [], isLoading } = useBrandAudit(brandId, 100);
  const { t } = useTranslation('settings');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">{t($ => $.brandConfig.audit.loading)}</span>
      </div>
    );
  }

  const count = entries.length;

  return (
    <div className="p-6 max-w-4xl space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{t($ => $.brandConfig.audit.title)}</h2>
        <Badge variant="outline" className="text-xs">{t($ => $.brandConfig.audit.entries, { count })}</Badge>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed border-border/60">
          <History className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">{t($ => $.brandConfig.audit.empty)}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((e) => <AuditTimelineEntry key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  );
}

function AuditTimelineEntry({ entry }: { entry: ConfigAuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation('settings');

  const dotColor = entry.action === 'create' ? 'bg-emerald-500'
    : entry.action === 'delete' ? 'bg-red-500'
    : 'bg-blue-500';

  const actionLabel = entry.action === 'create' ? t($ => $.brandConfig.audit.created)
    : entry.action === 'delete' ? t($ => $.brandConfig.audit.deleted)
    : t($ => $.brandConfig.audit.updated);

  const hasChanges = entry.old_value || entry.new_value;

  return (
    <div className="flex gap-3 group">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className={`h-2 w-2 rounded-full mt-2 shrink-0 ${dotColor}`} />
        <div className="flex-1 w-px bg-border/40 mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium">{actionLabel}</span>
          <span className="text-xs text-muted-foreground capitalize">{entry.category}</span>
          {entry.config_key && (
            <code className="text-[10px] bg-muted px-1 rounded">{entry.config_key}</code>
          )}
          <span className="text-xs text-muted-foreground ms-auto whitespace-nowrap">
            {new Date(entry.occurred_at).toLocaleString('en', {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          {entry.actor_name && (
            <span className="text-xs text-muted-foreground">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {t($ => $.brandConfig.audit.by as any, { actor: entry.actor_name })}
            </span>
          )}
          {entry.reason && (
            <span className="text-xs text-muted-foreground italic">"{entry.reason}"</span>
          )}
          {hasChanges && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] text-primary underline underline-offset-2 hover:no-underline"
            >
              {expanded ? t($ => $.brandConfig.audit.hideDiff) : t($ => $.brandConfig.audit.showDiff)}
            </button>
          )}
        </div>

        {expanded && hasChanges && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {entry.old_value && (
              <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-2">
                <p className="text-[10px] font-medium text-red-700 dark:text-red-400 mb-1">{t($ => $.brandConfig.audit.before)}</p>
                <pre className="text-[10px] text-muted-foreground overflow-auto max-h-24 whitespace-pre-wrap">
                  {JSON.stringify(entry.old_value, null, 2)}
                </pre>
              </div>
            )}
            {entry.new_value && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-2">
                <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 mb-1">{t($ => $.brandConfig.audit.after)}</p>
                <pre className="text-[10px] text-muted-foreground overflow-auto max-h-24 whitespace-pre-wrap">
                  {JSON.stringify(entry.new_value, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
