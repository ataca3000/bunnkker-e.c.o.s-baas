import { PageFormDrawer } from '@/components/form/drawer/page-form-drawer';
import { useEngineeringRun } from '../hooks/use-engineering';
import { CategoryStatusGrid } from './CategoryStatusGrid';
import { SeverityBadge } from './SeverityBadge';
import type { EngineeringRun } from '../types/engineering';
import { CheckCircle2, XCircle, GitBranch, GitCommit, Loader2 } from 'lucide-react';

interface RunDetailDrawerProps {
  runId: string | null;
  onClose: () => void;
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-1.5 text-sm border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function RunDetailContent({ run }: { run: EngineeringRun }) {
  const m = run.metrics;
  return (
    <div className="space-y-6 p-4">
      {/* Header summary */}
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{run.branch}</span>
            {run.commit && (
              <>
                <GitCommit className="h-3 w-3 text-muted-foreground" />
                <code className="text-xs text-muted-foreground">{run.commit}</code>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(run.certified_at).toLocaleString()} · {run.mode} mode
          </p>
        </div>
        {run.release_ready ? (
          <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Release Ready
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            Not Ready
          </div>
        )}
      </div>

      {/* Blockers */}
      {run.blockers.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/10">
          <p className="mb-2 text-xs font-semibold text-red-700 dark:text-red-400">BLOCKERS</p>
          <ul className="space-y-1">
            {run.blockers.map((b, i) => (
              <li key={i} className="text-xs text-red-700 dark:text-red-400">• {b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Category grid */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Categories
        </p>
        <CategoryStatusGrid categories={run.categories} />
      </div>

      {/* Metrics */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Metrics
        </p>
        <div className="rounded-md border bg-card px-3 py-1">
          <MetricRow label="Architecture Findings" value={`${m.arch_critical}C · ${m.arch_high}H · ${m.arch_medium}M`} />
          <MetricRow label="Repository Health" value={`${m.repo_health_pct}%`} />
          <MetricRow label="TODO / FIXME Count" value={m.todo_count} />
          <MetricRow label="PHPStan Baseline Issues" value={m.phpstan_baseline_issues} />
          <MetricRow label="Missing Translation Keys" value={m.missing_translation_keys} />
          <MetricRow label="Dead Code Files" value={m.dead_code_files} />
          <MetricRow label="PHP Files" value={m.total_php_files} />
          <MetricRow label="TS / TSX Files" value={m.total_tsx_files} />
        </div>
      </div>

      {/* Findings */}
      {run.findings && run.findings.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Findings ({run.findings.length})
          </p>
          <div className="space-y-2">
            {run.findings.map((f) => (
              <div key={f.id} className="rounded-md border bg-card p-3 text-sm">
                <div className="mb-1 flex items-start gap-2">
                  <SeverityBadge severity={f.severity} />
                  <span className="font-medium leading-tight">{f.title}</span>
                </div>
                {f.file && (
                  <p className="text-xs text-muted-foreground mb-1">
                    <code>{f.file}{f.line ? `:${f.line}` : ''}</code>
                  </p>
                )}
                {f.description && (
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                )}
                {f.fix_suggestion && (
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    Fix: {f.fix_suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RunDetailDrawer({ runId, onClose }: RunDetailDrawerProps) {
  const { data: run, isLoading } = useEngineeringRun(runId);

  return (
    <PageFormDrawer
      open={!!runId}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Certification Run Detail"
      size="lg"
    >
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : run ? (
        <RunDetailContent run={run} />
      ) : null}
    </PageFormDrawer>
  );
}
