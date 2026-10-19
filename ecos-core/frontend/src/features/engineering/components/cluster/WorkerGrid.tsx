import type { EngineeringWorker } from '../../types/engineering';
import { WORKER_STATUS_COLORS, WORKER_STATUS_LABELS } from '../../types/engineering';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  workers: EngineeringWorker[];
  onSelect: (w: EngineeringWorker) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onDrain: (id: string) => void;
  onDestroy: (id: string) => void;
}

function statusBadge(status: string) {
  const color = WORKER_STATUS_COLORS[status as keyof typeof WORKER_STATUS_COLORS] ?? 'bg-gray-400';
  const label = WORKER_STATUS_LABELS[status as keyof typeof WORKER_STATUS_LABELS] ?? status;
  return <Badge className={`${color} text-white text-xs px-2 py-0.5`}>{label}</Badge>;
}

export default function WorkerGrid({ workers, onSelect, onStart, onStop, onDrain, onDestroy }: Props) {
  if (workers.length === 0) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No workers registered.</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Current Task</TableHead>
          <TableHead>Heartbeat</TableHead>
          <TableHead>Completed</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workers.map(w => (
          <TableRow key={w.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(w)}>
            <TableCell className="font-medium">{w.name}</TableCell>
            <TableCell className="text-sm text-muted-foreground capitalize">{w.worker_type}</TableCell>
            <TableCell>{statusBadge(w.status)}</TableCell>
            <TableCell className="text-sm max-w-[160px] truncate">{(w as unknown as Record<string, unknown>).current_task ? ((w as unknown as Record<string, unknown>).current_task as { title: string }).title : <span className="text-muted-foreground">—</span>}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{w.last_heartbeat_at ? new Date(w.last_heartbeat_at).toLocaleTimeString() : '—'}</TableCell>
            <TableCell className="text-sm">{w.total_tasks_completed ?? 0}</TableCell>
            <TableCell className="text-right" onClick={e => e.stopPropagation()}>
              <div className="flex justify-end gap-1">
                {w.status === 'offline' && <Button size="sm" variant="outline" onClick={() => onStart(w.id)}>Start</Button>}
                {['idle', 'waiting', 'running', 'preparing'].includes(w.status) && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onDrain(w.id)}>Drain</Button>
                    <Button size="sm" variant="outline" onClick={() => onStop(w.id)}>Stop</Button>
                  </>
                )}
                {['offline', 'failed', 'stopped'].includes(w.status) && (
                  <Button size="sm" variant="destructive" onClick={() => onDestroy(w.id)}>Destroy</Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
