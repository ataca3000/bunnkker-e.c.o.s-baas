import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { EngineeringWorker, WorkerSession } from '../../types/engineering';
import { WORKER_STATUS_LABELS, WORKER_STATUS_COLORS } from '../../types/engineering';

interface Props {
  worker: EngineeringWorker | null;
  sessions: WorkerSession[];
  onClose: () => void;
  onRecover: (id: string) => void;
  onStop: (id: string) => void;
}

function statusColor(status: string) {
  return WORKER_STATUS_COLORS[status as keyof typeof WORKER_STATUS_COLORS] ?? 'bg-gray-400';
}

export default function WorkerDetailDrawer({ worker, sessions, onClose, onRecover, onStop }: Props) {
  if (!worker) return null;
  return (
    <Sheet open={!!worker} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {worker.name}
            <Badge className={`${statusColor(worker.status)} text-white text-xs`}>
              {WORKER_STATUS_LABELS[worker.status as keyof typeof WORKER_STATUS_LABELS] ?? worker.status}
            </Badge>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>Type: <span className="text-foreground capitalize">{worker.worker_type}</span></div>
            <div>Completed: <span className="text-foreground">{worker.total_tasks_completed ?? 0}</span></div>
            <div>Failed: <span className="text-foreground">{worker.total_tasks_failed ?? 0}</span></div>
            <div>Last Heartbeat: <span className="text-foreground">{worker.last_heartbeat_at ? new Date(worker.last_heartbeat_at).toLocaleTimeString() : '—'}</span></div>
          </div>
          {worker.workspace_base_path && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Workspace</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block truncate">{worker.workspace_base_path}</code>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            {['running', 'preparing', 'idle'].includes(worker.status) && (
              <Button size="sm" variant="outline" onClick={() => onStop(worker.id)}>Stop</Button>
            )}
            {['failed', 'offline'].includes(worker.status) && (
              <Button size="sm" onClick={() => onRecover(worker.id)}>Recover</Button>
            )}
          </div>
          <Separator />
          <div>
            <p className="text-xs font-medium mb-2">Recent Sessions ({sessions.length})</p>
            {sessions.length === 0 && <p className="text-xs text-muted-foreground">No sessions yet.</p>}
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="text-xs bg-muted/50 rounded px-2 py-1.5">
                  <div className="flex justify-between">
                    <span className="font-medium truncate">{(s as unknown as Record<string, unknown>).task ? ((s as unknown as Record<string, unknown>).task as { title: string }).title : s.task_id}</span>
                    <Badge variant="outline" className="text-[10px] ml-1">{s.status}</Badge>
                  </div>
                  {s.started_at && <div className="text-muted-foreground mt-0.5">{new Date(s.started_at).toLocaleString()}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
