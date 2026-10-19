import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, GitBranch, GitCommit, History, RefreshCw, ChevronRight } from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { cn }       from '@/lib/utils';
import { useEngineeringPipelines } from '../hooks/use-engineering';
import type { EngineeringPipeline, PipelineStatus } from '../types/engineering';
import { ROUTES } from '@/router/routes';

const STATUS_STYLE: Record<PipelineStatus, string> = {
  pending:   'bg-muted text-muted-foreground',
  running:   'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
  cancelled: 'bg-muted text-muted-foreground',
};

function PipelineRow({ pipeline }: { pipeline: EngineeringPipeline }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(ROUTES.engineeringPipeline)}
      className="w-full flex items-center gap-4 px-4 py-3 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-colors text-start"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium truncate">{pipeline.task_name}</span>
          <Badge className={cn('text-xs border-0 shrink-0', STATUS_STYLE[pipeline.status])}>
            {pipeline.status}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" /> {pipeline.branch}
          </span>
          {pipeline.commit_sha && (
            <span className="flex items-center gap-1">
              <GitCommit className="h-3 w-3" /> {pipeline.commit_sha}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {pipeline.duration_formatted}
          </span>
          <span>{pipeline.initiated_by}</span>
          {pipeline.started_at && (
            <span>{new Date(pipeline.started_at).toLocaleString()}</span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

export function EngineeringPipelineHistoryPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch, isRefetching } = useEngineeringPipelines(page);

  const pipelines = data?.data ?? [];
  const meta      = data?.meta;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5 pb-4 border-b border-border/60 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            Pipeline History
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All release pipelines — {meta?.total ?? 0} total
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-1.5">
          <RefreshCw className={cn('h-3.5 w-3.5', isRefetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading...</div>
        ) : pipelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <History className="h-10 w-10 opacity-20" />
            <p className="text-sm">No pipelines yet. Start one from the Release Manager.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pipelines.map((pipeline) => (
              <PipelineRow key={pipeline.id} pipeline={pipeline} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.lastPage > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {meta.page} of {meta.lastPage}
            </span>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= meta.lastPage}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
