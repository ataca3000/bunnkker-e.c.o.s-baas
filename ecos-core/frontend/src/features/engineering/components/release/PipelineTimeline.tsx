import React from 'react';
import type { ReleasePipelineRun } from '../../types/engineering';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
interface Props { runs: ReleasePipelineRun[]; onTrigger: () => void; canTrigger: boolean; }
const STATUS_COLOR: Record<string, string> = { pending: 'bg-yellow-500', running: 'bg-blue-500', success: 'bg-emerald-600', failed: 'bg-red-600', cancelled: 'bg-gray-500' };
export default function PipelineTimeline({ runs, onTrigger, canTrigger }: Props) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canTrigger && <Button size="sm" onClick={onTrigger} className="bg-violet-600 text-white hover:bg-violet-700">Trigger Pipeline</Button>}
      </div>
      {runs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No pipeline runs yet.</p>}
      <div className="space-y-3">
        {runs.map(run => (
          <div key={run.id} className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium font-mono">{run.pipeline_run_id ?? run.id}</p>
                <p className="text-xs text-muted-foreground">{run.environment} · {run.trigger_type} · {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={STATUS_COLOR[run.status] + ' text-white text-xs'}>{run.status}</Badge>
                {run.logs && (
                  <button onClick={() => setExpandedId(expandedId === run.id ? null : run.id)} className="text-xs text-blue-600 hover:underline">
                    {expandedId === run.id ? 'Hide' : 'Logs'}
                  </button>
                )}
              </div>
            </div>
            {expandedId === run.id && run.logs && (
              <pre className="mt-2 text-xs bg-muted rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">{run.logs}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
