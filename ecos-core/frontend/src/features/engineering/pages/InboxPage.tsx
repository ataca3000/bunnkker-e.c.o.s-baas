import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useInbox } from '../hooks/useInbox';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  type EngineeringTask,
  type TaskStatus,
} from '../types/engineering';
import { InboxKPIRow } from '../components/inbox/InboxKPIRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { inboxService } from '../services/inbox-service';
import { useToast } from '@/components/ds/use-toast';

const TaskDrawer = lazy(() =>
  import('../components/inbox/TaskDrawer')
    .then((m) => ({ default: m.TaskDrawer }))
    .catch(() => ({
      default: () => <div className="p-6 text-sm text-muted-foreground">Task drawer not yet available.</div>,
    }))
);

// ── Priority config ───────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<number, { label: string; className: string }> = {
  10: { label: 'Critical', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  8:  { label: 'High',     className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  5:  { label: 'Medium',   className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  3:  { label: 'Low',      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  1:  { label: 'Minimal',  className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

// ── Status badge color mapping ────────────────────────────────────────────────

function statusBadgeClass(color: string): string {
  const map: Record<string, string> = {
    slate:   'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    blue:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    indigo:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    violet:  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    amber:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    yellow:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    green:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    red:     'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    gray:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    stone:   'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
  };
  return map[color] ?? 'bg-muted text-muted-foreground';
}

// ── Valid transitions per status ──────────────────────────────────────────────

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  draft:     ['queued', 'cancelled'],
  queued:    ['assigned', 'cancelled'],
  assigned:  ['accepted', 'cancelled'],
  accepted:  ['running', 'cancelled'],
  running:   ['paused', 'completed', 'failed'],
  paused:    ['running', 'cancelled'],
  completed: ['released'],
  failed:    ['queued', 'cancelled'],
  cancelled: ['queued'],
  released:  ['archived'],
  archived:  [],
};

// ── New Task Dialog ───────────────────────────────────────────────────────────

interface NewTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { title: string; description?: string; priority: number; deadline?: string }) => Promise<void>;
}

function NewTaskDialog({ open, onClose, onCreate }: NewTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('5');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        priority: Number(priority),
        deadline: deadline || undefined,
      });
      setTitle(''); setDescription(''); setPriority('5'); setDeadline('');
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Engineering Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title <span className="text-red-500">*</span></Label>
            <Input
              id="task-title"
              placeholder="Describe the task..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <textarea
              id="task-desc"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Optional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).reverse().map(([val, { label }]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-deadline">Deadline</Label>
              <Input
                id="task-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main InboxPage ────────────────────────────────────────────────────────────

export function InboxPage() {
  const { toast } = useToast();
  const {
    tasks, kpis, meta, loading, page,
    selectedTask, drawerOpen,
    setFilters, setPage,
    openTask, createTask, transition,
    closeDrawer, refresh,
  } = useInbox();

  const [search, setSearch] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: search || undefined }));
      setPage(1);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, setFilters, setPage]);

  const handleStatusFilter = useCallback((val: string) => {
    setFilters((prev) => ({ ...prev, status: val === 'all' ? undefined : val }));
    setPage(1);
  }, [setFilters, setPage]);

  const handlePriorityFilter = useCallback((val: string) => {
    setFilters((prev) => ({ ...prev, priority: val === 'all' ? undefined : Number(val) }));
    setPage(1);
  }, [setFilters, setPage]);

  const handleOverdueToggle = useCallback(() => {
    setOverdueOnly((prev) => {
      const next = !prev;
      setFilters((f) => ({ ...f, overdue: next || undefined }));
      setPage(1);
      return next;
    });
  }, [setFilters, setPage]);

  const handleTransition = useCallback(async (taskId: string, status: string) => {
    try {
      await transition(taskId, status);
      toast({ title: `Task moved to ${TASK_STATUS_LABELS[status as TaskStatus] ?? status}` });
    } catch {
      toast({ title: 'Transition failed', variant: 'destructive' });
    }
  }, [transition, toast]);

  const handleDelete = useCallback(async (taskId: string) => {
    if (!confirm('Delete this task permanently?')) return;
    try {
      await inboxService.deleteTask(taskId);
      refresh();
      toast({ title: 'Task deleted' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  }, [refresh, toast]);

  const handleArchive = useCallback(async (task: EngineeringTask) => {
    const canArchive = VALID_TRANSITIONS[task.status]?.includes('archived');
    if (!canArchive) {
      toast({ title: 'Cannot archive in current status', variant: 'destructive' });
      return;
    }
    await handleTransition(task.id, 'archived');
  }, [handleTransition, toast]);

  const allStatuses = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Engineering Inbox</h1>
          <p className="text-sm text-muted-foreground">Manage and track engineering tasks and agent assignments.</p>
        </div>
        <Button onClick={() => setNewTaskOpen(true)}>+ New Task</Button>
      </div>

      {/* KPI Row */}
      <InboxKPIRow kpis={kpis} loading={!kpis && loading} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search tasks..."
          className="w-56"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <Select defaultValue="all" onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {allStatuses.map((s) => (
              <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select defaultValue="all" onValueChange={handlePriorityFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {Object.entries(PRIORITY_CONFIG).reverse().map(([val, { label }]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={overdueOnly ? 'default' : 'outline'}
          size="sm"
          onClick={handleOverdueToggle}
        >
          Overdue only
        </Button>

        <Button variant="ghost" size="sm" onClick={refresh} className="ml-auto">
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border bg-card text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Priority</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Agent</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Deadline</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && tasks.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No tasks found. Adjust filters or create a new task.
                </td>
              </tr>
            ) : (
              tasks.map((task) => {
                const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG[1];
                const statusColor = TASK_STATUS_COLORS[task.status];
                const validNext = VALID_TRANSITIONS[task.status] ?? [];
                const isOverdue = task.deadline
                  ? new Date(task.deadline) < new Date() && task.status !== 'completed' && task.status !== 'released' && task.status !== 'archived'
                  : false;

                return (
                  <tr
                    key={task.id}
                    className="group cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={() => openTask(task)}
                  >
                    {/* Priority */}
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', priorityCfg.className)}>
                        {task.priority} — {priorityCfg.label}
                      </span>
                    </td>

                    {/* Title */}
                    <td className="max-w-xs px-4 py-3">
                      <span className="line-clamp-1 font-medium">{task.title}</span>
                      {task.source_ref && (
                        <span className="block text-xs text-muted-foreground">{task.source_ref}</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusBadgeClass(statusColor))}>
                        {TASK_STATUS_LABELS[task.status]}
                      </span>
                    </td>

                    {/* Agent */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {task.agent?.name ?? <span className="italic text-muted-foreground/60">Unassigned</span>}
                    </td>

                    {/* Deadline */}
                    <td className="px-4 py-3">
                      {task.deadline ? (
                        <span className={cn('text-xs', isOverdue && 'font-semibold text-red-600 dark:text-red-400')}>
                          {new Date(task.deadline).toLocaleDateString()}
                          {isOverdue && ' (overdue)'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {validNext.length > 0 && (
                          <Select onValueChange={(val) => handleTransition(task.id, val)}>
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue placeholder="Transition" />
                            </SelectTrigger>
                            <SelectContent>
                              {validNext.map((s) => (
                                <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleArchive(task)}
                          title="Archive"
                        >
                          Archive
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                          onClick={() => handleDelete(task.id)}
                          title="Delete"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.lastPage > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(meta.page - 1) * meta.perPage + 1}–{Math.min(meta.page * meta.perPage, meta.total)} of {meta.total} tasks
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(meta.lastPage, 7) }).map((_, i) => {
              const p = i + 1;
              return (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  className="w-8"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.lastPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Task Drawer (lazy) */}
      <Suspense fallback={null}>
        {drawerOpen && selectedTask && (
          <TaskDrawer
            task={selectedTask}
            open={drawerOpen}
            onClose={closeDrawer}
            onTransition={(status: string, reason: string) => transition(selectedTask.id, status, reason)}
          />
        )}
      </Suspense>

      {/* New Task Dialog */}
      <NewTaskDialog
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        onCreate={async (data) => { await createTask(data); }}
      />
    </div>
  );
}
