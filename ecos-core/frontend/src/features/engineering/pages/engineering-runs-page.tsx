import { useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, GitBranch, GitCommit } from 'lucide-react';
import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { UniversalDataGrid } from '@/components/data-grid/universal-data-grid';
import { Pagination } from '@/components/crud/pagination';
import { useEngineeringRuns } from '../hooks/use-engineering';
import { RunDetailDrawer } from '../components/RunDetailDrawer';
import type { DataGridColumnDef } from '@/components/data-grid/types';
import type { EngineeringRun } from '../types/engineering';

const SCORE_COLOR = (score: number) =>
  score >= 90 ? 'text-green-600' :
  score >= 80 ? 'text-yellow-600' :
  'text-red-600';

const columns: DataGridColumnDef<EngineeringRun>[] = [
  {
    key: 'branch',
    label: 'Branch / Commit',
    cell: (row: EngineeringRun) => (
      <div className="flex items-center gap-2">
        <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium">{row.branch}</span>
        {row.commit && (
          <>
            <GitCommit className="h-3 w-3 text-muted-foreground" />
            <code className="text-xs text-muted-foreground">{row.commit}</code>
          </>
        )}
      </div>
    ),
  },
  {
    key: 'overall_score',
    label: 'Score',
    cell: (row: EngineeringRun) => (
      <span className={`text-sm font-bold tabular-nums ${SCORE_COLOR(row.overall_score)}`}>
        {row.overall_score}/100
      </span>
    ),
  },
  {
    key: 'release_ready',
    label: 'Release',
    cell: (row: EngineeringRun) => row.release_ready ? (
      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-xs font-semibold">Ready</span>
      </div>
    ) : (
      <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
        <XCircle className="h-4 w-4" />
        <span className="text-xs font-semibold">Blocked</span>
      </div>
    ),
  },
  {
    key: 'mode',
    label: 'Mode',
    cell: (row: EngineeringRun) => (
      <span className="rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground capitalize">
        {row.mode}
      </span>
    ),
  },
  {
    key: 'certified_at',
    label: 'Certified At',
    cell: (row: EngineeringRun) => (
      <span className="text-sm text-muted-foreground">
        {new Date(row.certified_at).toLocaleString()}
      </span>
    ),
  },
];

export function EngineeringRunsPage() {
  const [page, setPage] = useState(1);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { data, isLoading, isFetching, refetch } = useEngineeringRuns(page, 15);

  const runs = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-6 p-6">
      <WorkspaceHeader
        title="Certification Runs"
        description="History of all engineering certification runs"
        primaryAction={{
          key: 'refresh',
          label: isFetching ? 'Refreshing…' : 'Refresh',
          icon: RefreshCw,
          onClick: () => refetch(),
          disabled: isFetching,
        }}
      />

      <UniversalDataGrid
        data={runs}
        columns={columns}
        rowId={(row) => row.id}
        loading={isLoading}
        onRowClick={(row) => setSelectedRunId(row.id)}
      />

      {meta && meta.lastPage > 1 && (
        <Pagination
          meta={meta}
          onPageChange={setPage}
        />
      )}

      <RunDetailDrawer runId={selectedRunId} onClose={() => setSelectedRunId(null)} />
    </div>
  );
}
