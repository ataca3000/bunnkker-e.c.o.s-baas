import { memo, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Clock,
  FlaskConical,
  Layers2,
  Loader2,
  Package,
  PackageX,
  Play,
  RefreshCw,
  Settings2,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/router/routes';
import { usePreparationWave, useAdvanceWave } from '../hooks/use-preparation';
import { WavePicker, useSelectedWaveId } from '../components/wave-picker';
import type { PreparationWave, WaveStatus } from '../types/preparation';

// ── Status colors (CSS only, no translated labels) ─────────────────────────────

const STATUS_COLORS: Record<WaveStatus, string> = {
  draft:            'bg-gray-100 text-gray-700',
  collecting:       'bg-cyan-100 text-cyan-700',
  planning:         'bg-blue-100 text-blue-700',
  shortage_blocked: 'bg-amber-100 text-amber-700',
  preparing:        'bg-purple-100 text-purple-700',
  completed:        'bg-green-100 text-green-700',
  closed:           'bg-slate-100 text-slate-600',
  cancelled:        'bg-red-100 text-red-700',
};

// ── Tab definitions (keys only, labels come from i18n) ────────────────────────

const WORKSPACE_TABS = [
  { key: 'dashboard', path: ROUTES.waveWorkspace,        Icon: Layers2      },
  { key: 'products',  path: ROUTES.waveProductDemand,    Icon: Package      },
  { key: 'materials', path: ROUTES.waveRawMaterials,     Icon: FlaskConical },
  { key: 'missing',   path: ROUTES.waveMissingMaterials, Icon: PackageX     },
  { key: 'orders',    path: ROUTES.waveOrders,           Icon: ShoppingCart },
  { key: 'settings',  path: ROUTES.waveSettings,         Icon: Settings2    },
] as const;

// ── Countdown (isolated to prevent Outlet re-renders every second) ─────────────

const CountdownTimer = memo(function CountdownTimer({ wave }: { wave: PreparationWave | undefined }) {
  const { t } = useTranslation('operations');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const [remaining, setRemaining] = useState(0);

  // Pulled out so the countdown depends on the two fields it actually reads,
  // rather than on the whole wave object changing identity every refetch.
  const planningDate = wave?.planning_date;
  const status = wave?.status;

  useEffect(() => {
    if (!planningDate || !status || !['draft', 'planning'].includes(status)) {
      setRemaining(0);
      return;
    }
    const target = new Date(`${planningDate}T08:00:00`);
    if (target <= new Date()) { setRemaining(0); return; }
    const update = () => setRemaining(Math.max(0, target.getTime() - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [planningDate, status]);

  if (!wave) return null;

  if (remaining > 0) {
    const s   = Math.floor(remaining / 1000);
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const formatted = h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return (
      <div className="flex flex-col items-end shrink-0">
        <span className="text-[10px] text-muted-foreground leading-none">{t($ => $.wave.workspace.prepStartsIn)}</span>
        <span className="text-sm font-mono font-bold tabular-nums leading-tight">{formatted}</span>
      </div>
    );
  }

  const isLive = wave.status === 'preparing';
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
      <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
      {tAny(`wave.stageLabels.${wave.status}`)}
    </div>
  );
});

// ── Header KPI chip ───────────────────────────────────────────────────────────

function KpiChip({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent?: 'danger' | 'warn' | 'success';
}) {
  const cls =
    accent === 'danger'  ? 'text-red-700 bg-red-50 border-red-200' :
    accent === 'warn'    ? 'text-amber-700 bg-amber-50 border-amber-200' :
    accent === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    'text-muted-foreground bg-muted/50 border-border/60';
  return (
    <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs shrink-0 ${cls}`}>
      {icon}
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] opacity-75">{label}</span>
    </div>
  );
}

// ── Summary bar item ──────────────────────────────────────────────────────────

function SummaryItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: 'danger' | 'warn' | 'success';
}) {
  const valCls =
    accent === 'danger'  ? 'text-red-700 font-semibold' :
    accent === 'warn'    ? 'text-amber-700 font-semibold' :
    accent === 'success' ? 'text-emerald-700' :
    'text-foreground';
  return (
    <span className="shrink-0 flex items-center gap-0.5">
      <span className="text-muted-foreground">{label}:</span>
      <span className={`tabular-nums ml-0.5 ${valCls}`}>{value}</span>
    </span>
  );
}

function fmtN(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function safeDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  // Normalize MySQL datetime format (space → T) for cross-browser compatibility
  const d = new Date(val.includes(' ') && !val.includes('T') ? val.replace(' ', 'T') : val);
  return isNaN(d.getTime()) ? null : d;
}

function fmtTime(val: string | null | undefined): string {
  const d = safeDate(val);
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

function fmtLocalDate(val: string | null | undefined): string {
  const d = safeDate(val);
  return d ? d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function WaveWorkspaceLayout() {
  const { t } = useTranslation('operations');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const { pathname }   = useLocation();
  const waveId         = useSelectedWaveId();
  const { data: wave, isFetching } = usePreparationWave(waveId);
  const advance        = useAdvanceWave();

  const materials     = wave?.material_requirements ?? [];
  const missing       = materials.filter((m) => m.shortage && !m.resolved);
  const totalRequired = wave?.total_units_required ?? 0;
  const totalPrepared = wave?.total_units_prepared ?? 0;
  const remaining     = Math.max(0, totalRequired - totalPrepared);

  // Preserve ?wave_id= when navigating between tabs
  function tabHref(path: string) {
    return waveId ? `${path}?wave_id=${encodeURIComponent(waveId)}` : path;
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Shared Workspace Header ──────────────────────────────────────────── */}
      <header className="border-b border-border/60 bg-card shrink-0">
        {/* Top row: wave identity + wave picker + countdown */}
        <div className="flex items-center justify-between gap-3 px-4 pt-2.5 pb-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <Layers2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              {wave ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold font-mono leading-none">{wave.wave_number}</span>
                    <Badge className={`text-[10px] h-4 px-1.5 ${STATUS_COLORS[wave.status]}`}>
                      {tAny(`wave.stageLabels.${wave.status}`)}
                    </Badge>
                    {wave.shortage_detected && (
                      <Badge className="text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700">
                        {t($ => $.wave.workspace.shortage)}
                      </Badge>
                    )}
                    {isFetching && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                        {t($ => $.wave.workspace.syncing)}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {fmtLocalDate(wave.planning_date)}
                  </div>
                </>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">{t($ => $.wave.workspace.title)}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {wave && <CountdownTimer wave={wave} />}
            {wave?.status === 'collecting' && (
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1.5"
                disabled={advance.isPending}
                onClick={() => waveId && advance.mutate(waveId)}
              >
                {advance.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Play className="h-3 w-3" />}
                {t($ => $.wave.workspace.startPreparation)}
              </Button>
            )}
            <WavePicker />
          </div>
        </div>

        {/* KPI chips row */}
        {wave && (
          <div className="flex items-center gap-2 px-4 pb-2 overflow-x-auto">
            <KpiChip
              icon={<ShoppingCart className="h-3 w-3" />}
              label={t($ => $.wave.workspace.kpis.orders)}
              value={wave.orders_count}
            />
            <KpiChip
              icon={<Package className="h-3 w-3" />}
              label={t($ => $.wave.workspace.kpis.products)}
              value={wave.products_count}
            />
            <KpiChip
              icon={<CheckCircle2 className="h-3 w-3" />}
              label={t($ => $.wave.workspace.kpis.required)}
              value={fmtN(totalRequired)}
            />
            <KpiChip
              icon={<PackageX className="h-3 w-3" />}
              label={t($ => $.wave.workspace.kpis.missing)}
              value={missing.length}
              accent={missing.length > 0 ? 'danger' : undefined}
            />
            <KpiChip
              icon={<TrendingUp className="h-3 w-3" />}
              label={t($ => $.wave.workspace.kpis.complete)}
              value={`${wave.completion_pct.toFixed(0)}%`}
              accent={wave.completion_pct >= 100 ? 'success' : undefined}
            />
          </div>
        )}
      </header>

      {/* ── Workspace Tab Navigation ─────────────────────────────────────────── */}
      <nav
        className="flex items-center border-b border-border/60 bg-background shrink-0 overflow-x-auto"
        aria-label="Wave workspace views"
      >
        {WORKSPACE_TABS.map(({ key, path, Icon }) => {
          const active = pathname === path;
          return (
            <Link
              key={key}
              to={tabHref(path)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-3.5 w-3.5" />
              {tAny(`wave.workspace.tabs.${key}`)}
            </Link>
          );
        })}
      </nav>

      {/* ── Sticky Summary Bar ───────────────────────────────────────────────── */}
      {wave && (
        <div className="sticky top-0 z-10 flex items-center gap-2.5 px-4 py-1.5 border-b border-border/40 bg-muted/30 text-[11px] overflow-x-auto shrink-0">
          <SummaryItem label={t($ => $.wave.workspace.summary.orders)}    value={wave.orders_count} />
          <span className="text-border shrink-0">·</span>
          <SummaryItem label={t($ => $.wave.workspace.summary.products)}  value={wave.products_count} />
          <span className="text-border shrink-0">·</span>
          <SummaryItem label={t($ => $.wave.workspace.summary.required)}  value={fmtN(totalRequired)} />
          <span className="text-border shrink-0">·</span>
          <SummaryItem label={t($ => $.wave.workspace.summary.prepared)}  value={fmtN(totalPrepared)} accent="success" />
          <span className="text-border shrink-0">·</span>
          <SummaryItem label={t($ => $.wave.workspace.summary.remaining)} value={fmtN(remaining)} accent={remaining > 0 ? 'warn' : undefined} />
          <span className="text-border shrink-0">·</span>
          <SummaryItem label={t($ => $.wave.workspace.summary.missing)}   value={missing.length} accent={missing.length > 0 ? 'danger' : undefined} />
          <span className="text-border shrink-0">·</span>
          <SummaryItem label={t($ => $.wave.workspace.summary.stage)}     value={tAny(`wave.stageLabels.${wave.status}`)} />
          <span className="ms-auto flex items-center gap-1 text-muted-foreground shrink-0">
            <Clock className="h-2.5 w-2.5" />
            {fmtTime(wave.updated_at)}
          </span>
        </div>
      )}

      {/* ── Page Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
