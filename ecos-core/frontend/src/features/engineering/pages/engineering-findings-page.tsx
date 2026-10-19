import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { UniversalDataGrid } from '@/components/data-grid/universal-data-grid';
import { Pagination } from '@/components/crud/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEngineeringFindings } from '../hooks/use-engineering';
import { SeverityBadge } from '../components/SeverityBadge';
import type { DataGridColumnDef } from '@/components/data-grid/types';
import type { EngineeringFinding, FindingSeverity } from '../types/engineering';

const columns: DataGridColumnDef<EngineeringFinding>[] = [
  {
    key: 'severity',
    label: 'Severity',
    cell: (row: EngineeringFinding) => <SeverityBadge severity={row.severity as FindingSeverity} />,
  },
  {
    key: 'category',
    label: 'Category',
    cell: (row: EngineeringFinding) => (
      <span className="rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground font-mono">
        {row.category}
      </span>
    ),
  },
  {
    key: 'title',
    label: 'Finding',
    cell: (row: EngineeringFinding) => (
      <div className="max-w-md">
        <p className="text-sm font-medium leading-tight">{row.title}</p>
        {row.file && (
          <code className="text-xs text-muted-foreground">
            {row.file}{row.line ? `:${row.line}` : ''}
          </code>
        )}
      </div>
    ),
  },
  {
    key: 'fix_suggestion',
    label: 'Fix',
    cell: (row: EngineeringFinding) => row.fix_suggestion ? (
      <p className="text-xs text-blue-600 dark:text-blue-400 max-w-xs truncate">
        {row.fix_suggestion}
      </p>
    ) : null,
  },
  {
    key: 'created_at',
    label: 'Detected',
    cell: (row: EngineeringFinding) => (
      <span className="text-xs text-muted-foreground">
        {new Date(row.created_at).toLocaleDateString()}
      </span>
    ),
  },
];

export function EngineeringFindingsPage() {
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState<string>('');

  const { data, isLoading, isFetching, refetch } = useEngineeringFindings({
    page,
    perPage: 25,
    severity: severity || undefined,
  });

  const findings = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-6 p-6">
      <WorkspaceHeader
        title="Engineering Findings"
        description="All violations and issues detected across certification runs"
        primaryAction={{
          key: 'refresh',
          label: isFetching ? 'Refreshing…' : 'Refresh',
          icon: RefreshCw,
          onClick: () => refetch(),
          disabled: isFetching,
        }}
        toolbarSlot={
          <Select
            value={severity || 'all'}
            onValueChange={(v) => { setSeverity(v === 'all' ? '' : v); setPage(1); }}
          >
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="All severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <UniversalDataGrid
        data={findings}
        columns={columns}
        rowId={(row: EngineeringFinding) => row.id}
        loading={isLoading}
      />

      {meta && meta.lastPage > 1 && (
        <Pagination
          meta={meta}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
