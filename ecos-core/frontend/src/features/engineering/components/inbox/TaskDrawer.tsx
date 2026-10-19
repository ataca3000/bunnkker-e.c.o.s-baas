import { useState, useEffect, useCallback } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Archive, RefreshCw, ArrowRight, Paperclip, Upload,
  CheckSquare, Link2, GitMerge, Terminal, MessageSquare,
  Clock, AlertCircle,
} from 'lucide-react';
import { inboxService } from '../../services/inbox-service';
import type {
  EngineeringTask, TaskComment, TaskAttachment, TaskDependency,
  EngineeringReleaseCandidate, ExecutionSession, TaskHistoryEntry,
  TaskChecklist,
} from '../../types/engineering';
import {
  TASK_STATUS_LABELS, TASK_STATUS_COLORS, TASK_PRIORITY_LABELS,
} from '../../types/engineering';
import { useToast } from '@/components/ds/use-toast';

// ── Status / Priority badge helpers ─────────────────────────────────────────

const STATUS_VARIANT_MAP: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  stone: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
};

function StatusBadge({ status }: { status: EngineeringTask['status'] }) {
  const color = TASK_STATUS_COLORS[status] ?? 'slate';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_VARIANT_MAP[color]}`}>
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  const p = priority >= 8 ? 'red' : priority >= 5 ? 'amber' : priority >= 3 ? 'blue' : 'slate';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_VARIANT_MAP[p]}`}>
      {TASK_PRIORITY_LABELS[priority] ?? `P${priority}`}
    </span>
  );
}

const EVENT_LEVEL_CLASS: Record<string, string> = {
  debug: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface TaskDrawerProps {
  task: EngineeringTask | null;
  open: boolean;
  onClose: () => void;
  onTransition?: (taskId: string, status: string, reason?: string) => Promise<void>;
  onRefresh?: () => void;
}

// ── Valid next statuses (simplified forward map) ─────────────────────────────

const NEXT_STATUSES: Partial<Record<EngineeringTask['status'], EngineeringTask['status'][]>> = {
  draft: ['queued'],
  queued: ['assigned', 'cancelled'],
  assigned: ['accepted', 'cancelled'],
  accepted: ['running', 'cancelled'],
  running: ['paused', 'completed', 'failed'],
  paused: ['running', 'cancelled'],
  completed: ['released'],
  failed: ['queued'],
  released: ['archived'],
};

// ── Main component ────────────────────────────────────────────────────────────

export function TaskDrawer({ task, open, onClose, onTransition, onRefresh }: TaskDrawerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  // Per-tab lazy data
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [rcs, setRcs] = useState<EngineeringReleaseCandidate[]>([]);
  const [session, setSession] = useState<ExecutionSession | null>(null);

  // Comment compose
  const [commentBody, setCommentBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Transition
  const [transitioning, setTransitioning] = useState(false);

  const taskId = task?.id;

  const loadTabData = useCallback(async (tab: string) => {
    if (!taskId) return;
    try {
      if (tab === 'comments') setComments(await inboxService.listComments(taskId));
      if (tab === 'attachments') setAttachments((await inboxService.getTask(taskId)).attachments ?? []);
      if (tab === 'dependencies') setDependencies(await inboxService.listDependencies(taskId));
      if (tab === 'rc') {
        const res = await inboxService.listReleaseCandidates({});
        // Filter RCs that contain this task (based on task relations if present)
        setRcs(res.data);
      }
      if (tab === 'execution') {
        const full = await inboxService.getTask(taskId);
        setSession((full as EngineeringTask & { current_session?: ExecutionSession }).current_session ?? null);
      }
    } catch {
      toast({ title: 'Failed to load tab data', variant: 'destructive' });
    }
  }, [taskId, toast]);

  useEffect(() => {
    if (open && taskId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab('overview');
      setComments([]);
      setAttachments([]);
      setDependencies([]);
      setRcs([]);
      setSession(null);
      setCommentBody('');
    }
  }, [open, taskId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && taskId) loadTabData(activeTab);
  }, [activeTab, open, taskId, loadTabData]);

  async function handleTransition(status: EngineeringTask['status']) {
    if (!taskId || !onTransition) return;
    setTransitioning(true);
    try {
      await onTransition(taskId, status);
      onRefresh?.();
    } catch {
      toast({ title: 'Transition failed', variant: 'destructive' });
    } finally {
      setTransitioning(false);
    }
  }

  async function handleArchive() {
    if (!taskId || !onTransition) return;
    setTransitioning(true);
    try {
      await onTransition(taskId, 'archived');
      onRefresh?.();
      onClose();
    } catch {
      toast({ title: 'Archive failed', variant: 'destructive' });
    } finally {
      setTransitioning(false);
    }
  }

  async function submitComment() {
    if (!taskId || !commentBody.trim()) return;
    setSubmittingComment(true);
    try {
      const c = await inboxService.createComment(taskId, commentBody.trim(), isInternal);
      setComments(prev => [...prev, c]);
      setCommentBody('');
    } catch {
      toast({ title: 'Failed to post comment', variant: 'destructive' });
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!taskId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    try {
      const att = await inboxService.uploadAttachment(taskId, file);
      setAttachments(prev => [...prev, att]);
      toast({ title: 'Attachment uploaded' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    }
    e.target.value = '';
  }

  if (!task) return null;

  const nextStatuses = NEXT_STATUSES[task.status] ?? [];

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="flex flex-col p-0 sm:!max-w-[640px]"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 border-b px-5 py-4 gap-2">
          <div className="flex items-start justify-between gap-3 pr-6">
            <SheetTitle className="text-base leading-snug line-clamp-2 flex-1">
              {task.title}
            </SheetTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.deadline && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {fmt(task.deadline)}
              </span>
            )}
          </div>
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {nextStatuses.filter(s => s !== 'archived').map(s => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                disabled={transitioning || !onTransition}
                onClick={() => handleTransition(s)}
                className="h-7 text-xs gap-1"
              >
                <ArrowRight className="h-3 w-3" />
                {TASK_STATUS_LABELS[s]}
              </Button>
            ))}
            {task.status !== 'archived' && (
              <Button
                size="sm"
                variant="ghost"
                disabled={transitioning || !onTransition}
                onClick={handleArchive}
                className="h-7 text-xs gap-1 text-muted-foreground"
              >
                <Archive className="h-3 w-3" />
                Archive
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRefresh?.()}
              className="h-7 text-xs gap-1 text-muted-foreground ml-auto"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className="shrink-0 w-full justify-start rounded-none border-b bg-transparent px-5 h-10 gap-0">
            {[
              { value: 'overview', label: 'Overview' },
              { value: 'activity', label: 'Activity' },
              { value: 'comments', label: 'Comments', icon: <MessageSquare className="h-3 w-3" /> },
              { value: 'checklist', label: 'Checklist', icon: <CheckSquare className="h-3 w-3" /> },
              { value: 'attachments', label: 'Files', icon: <Paperclip className="h-3 w-3" /> },
              { value: 'dependencies', label: 'Deps', icon: <Link2 className="h-3 w-3" /> },
              { value: 'rc', label: 'RC', icon: <GitMerge className="h-3 w-3" /> },
              { value: 'execution', label: 'Exec', icon: <Terminal className="h-3 w-3" /> },
            ].map(t => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 h-10 text-xs gap-1"
              >
                {t.icon}{t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="flex-1">

            {/* ── 1. Overview ─────────────────────────────────────── */}
            <TabsContent value="overview" className="m-0 p-5 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Description</p>
                <p className="text-sm whitespace-pre-wrap text-foreground/80 leading-relaxed">
                  {task.description ?? <span className="italic text-muted-foreground">No description</span>}
                </p>
              </div>
              <div className="rounded-md border bg-card divide-y divide-border text-sm">
                {[
                  { label: 'Source Type', value: task.source_type ?? '—' },
                  { label: 'Source Ref', value: task.source_ref ?? '—' },
                  { label: 'Deadline', value: task.deadline ? fmt(task.deadline) : '—' },
                  { label: 'Created', value: fmt(task.created_at) },
                  { label: 'Retries', value: `${task.retry_count} / ${task.max_retries}` },
                  { label: 'Agent', value: task.agent?.name ?? task.assigned_agent_id ?? '—' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between px-3 py-2">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium text-right max-w-[60%] break-all">{row.value}</span>
                  </div>
                ))}
              </div>
              {task.labels && task.labels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {task.labels.map(l => (
                    <span
                      key={l.id}
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ background: `${l.color}22`, color: l.color, border: `1px solid ${l.color}44` }}
                    >
                      {l.name}
                    </span>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── 2. Activity ──────────────────────────────────────── */}
            <TabsContent value="activity" className="m-0 p-5">
              {(task.history ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No activity recorded.</p>
              ) : (
                <ol className="space-y-3">
                  {(task.history as TaskHistoryEntry[]).map(h => (
                    <li key={h.id} className="flex gap-3 text-sm">
                      <div className="mt-0.5 h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <AlertCircle className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground/90">
                          <span className="font-medium">{h.actor?.name ?? 'System'}</span>
                          {' · '}
                          <span className="text-muted-foreground">{h.event_type}</span>
                          {h.from_status && h.to_status && (
                            <> &mdash; <span className="text-muted-foreground">{h.from_status} → {h.to_status}</span></>
                          )}
                        </p>
                        {h.reason && <p className="text-xs text-muted-foreground mt-0.5">{h.reason}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">{fmt(h.occurred_at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>

            {/* ── 3. Comments ──────────────────────────────────────── */}
            <TabsContent value="comments" className="m-0 flex flex-col h-full">
              <div className="p-5 space-y-4 flex-1">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No comments yet.</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0">
                        {(c.author?.name ?? 'U')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{c.author?.name ?? 'Unknown'}</span>
                          {c.is_internal && (
                            <span className="rounded-full bg-amber-100 text-amber-700 text-xs px-2 py-0.5 dark:bg-amber-900/40 dark:text-amber-300">Internal</span>
                          )}
                          <span className="text-xs text-muted-foreground">{fmt(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Compose */}
              <div className="shrink-0 border-t p-4 space-y-2">
                <textarea
                  rows={3}
                  value={commentBody}
                  onChange={e => setCommentBody(e.target.value)}
                  placeholder="Write a comment..."
                  className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={e => setIsInternal(e.target.checked)}
                      className="rounded"
                    />
                    Internal only
                  </label>
                  <Button size="sm" onClick={submitComment} disabled={submittingComment || !commentBody.trim()}>
                    {submittingComment ? 'Posting…' : 'Post'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ── 4. Checklist ─────────────────────────────────────── */}
            <TabsContent value="checklist" className="m-0 p-5 space-y-5">
              {!task.checklists || task.checklists.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No checklists.</p>
              ) : (
                (task.checklists as TaskChecklist[]).map(cl => (
                  <div key={cl.id}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{cl.title}</p>
                      <span className="text-xs text-muted-foreground">
                        {cl.progress.completed}/{cl.progress.total}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${cl.progress.percent}%` }}
                      />
                    </div>
                    <ul className="space-y-1.5">
                      {cl.items.map(item => (
                        <li key={item.id} className="flex items-start gap-2 text-sm">
                          <input type="checkbox" checked={item.is_completed} readOnly className="mt-0.5 accent-primary" />
                          <span className={item.is_completed ? 'line-through text-muted-foreground' : ''}>{item.content}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
              {task.checklist_progress && (
                <div className="rounded-md border bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">Overall progress</p>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${task.checklist_progress.percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {task.checklist_progress.completed} / {task.checklist_progress.total} items ({task.checklist_progress.percent}%)
                  </p>
                </div>
              )}
            </TabsContent>

            {/* ── 5. Attachments ───────────────────────────────────── */}
            <TabsContent value="attachments" className="m-0 p-5 space-y-3">
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span><Upload className="h-3.5 w-3.5 mr-1.5" />Upload File</span>
                </Button>
                <input type="file" className="sr-only" onChange={handleUpload} />
              </label>
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No attachments.</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border">
                  {attachments.map(a => (
                    <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate font-medium">{a.original_filename}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{fmtBytes(a.size_bytes)}</span>
                      </div>
                      {a.download_url && (
                        <a href={a.download_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline ml-2 shrink-0">
                          Download
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            {/* ── 6. Dependencies ──────────────────────────────────── */}
            <TabsContent value="dependencies" className="m-0 p-5">
              {dependencies.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No dependencies.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left pb-2 font-medium">Task</th>
                        <th className="text-left pb-2 font-medium">Type</th>
                        <th className="text-left pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {dependencies.map(d => (
                        <tr key={d.id}>
                          <td className="py-2 pr-4 max-w-[240px]">
                            <span className="truncate block">{d.depends_on_task?.title ?? d.depends_on_task_id}</span>
                          </td>
                          <td className="py-2 pr-4 capitalize text-muted-foreground">{d.dependency_type.replace('_', ' ')}</td>
                          <td className="py-2">
                            {d.depends_on_task ? <StatusBadge status={d.depends_on_task.status as EngineeringTask['status']} /> : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ── 7. Release Candidate ─────────────────────────────── */}
            <TabsContent value="rc" className="m-0 p-5 space-y-3">
              {rcs.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No release candidates linked.</p>
              ) : (
                rcs.map(rc => (
                  <div key={rc.id} className="rounded-md border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{rc.title}</p>
                        {rc.version_tag && <p className="text-xs text-muted-foreground">{rc.version_tag}</p>}
                      </div>
                      <Badge variant="outline" className="capitalize shrink-0 text-xs">
                        {rc.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{fmt(rc.created_at)}</p>
                  </div>
                ))
              )}
            </TabsContent>

            {/* ── 8. Execution ─────────────────────────────────────── */}
            <TabsContent value="execution" className="m-0 p-5 space-y-4">
              {!session ? (
                <p className="text-sm text-muted-foreground italic">No active execution session.</p>
              ) : (
                <>
                  <div className="rounded-md border bg-card px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Session status</span>
                      <Badge variant="outline" className="capitalize">{session.status.replace('_', ' ')}</Badge>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{session.progress_percent}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${session.progress_percent}%` }}
                        />
                      </div>
                      {session.progress_message && (
                        <p className="text-xs text-muted-foreground mt-1">{session.progress_message}</p>
                      )}
                    </div>
                    {session.git_branch && (
                      <p className="text-xs text-muted-foreground">Branch: <code>{session.git_branch}</code></p>
                    )}
                  </div>

                  {session.events && session.events.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Recent Events (last 20)
                      </p>
                      <div className="rounded-md border bg-black/5 dark:bg-white/5 font-mono text-xs divide-y divide-border">
                        {session.events.slice(-20).map(ev => (
                          <div key={ev.id} className="flex items-start gap-2 px-3 py-1.5">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 mt-0.5 ${EVENT_LEVEL_CLASS[ev.level] ?? EVENT_LEVEL_CLASS.info}`}>
                              {ev.level.toUpperCase()}
                            </span>
                            <span className="flex-1 min-w-0 break-words text-foreground/80">{ev.message}</span>
                            <span className="text-muted-foreground shrink-0 text-[10px]">
                              {new Date(ev.occurred_at).toLocaleTimeString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
