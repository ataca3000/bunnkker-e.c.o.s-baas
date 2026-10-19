import { useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  GitBranch,
  GitCommit,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Zap,
} from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Badge }    from '@/components/ui/badge';
import { useToast } from '@/components/ds/use-toast';
import { cn }       from '@/lib/utils';
import {
  useActivePipeline,
  useCancelPipeline,
  useCreatePipeline,
  usePipelineTemplates,
  useResumePipeline,
  useRestartPipeline,
  useRetryPipeline,
  useSkipStage,
} from '../hooks/use-engineering';
import { PipelineStageTimeline } from '../components/PipelineStageTimeline';
import type { PipelineStatus } from '../types/engineering';

const STATUS_BADGE: Record<PipelineStatus, { label: string; className: string }> = {
  pending:   { label: 'Pending',   className: 'bg-muted text-muted-foreground' },
  running:   { label: 'Running',   className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  failed:    { label: 'Failed',    className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
};


export function EngineeringPipelinePage() {
  const { toast } = useToast();

  const [taskName,  setTaskName]  = useState('');
  const [branch,    setBranch]    = useState('main');
  const [template,  setTemplate]  = useState('release');
  const [skipStageTarget, setSkipStageTarget] = useState<string | null>(null);

  const { data: activePipeline, isLoading } = useActivePipeline();
  const { data: templates = [] }            = usePipelineTemplates();

  const createMutation  = useCreatePipeline();
  const cancelMutation  = useCancelPipeline();
  const retryMutation   = useRetryPipeline();
  const resumeMutation  = useResumePipeline();
  const restartMutation = useRestartPipeline();
  const skipStageMutation = useSkipStage();

  const isPipelineRunning = activePipeline?.status === 'running' || activePipeline?.status === 'pending';

  function handleCreate() {
    if (isPipelineRunning) return;

    createMutation.mutate(
      { task_name: taskName || 'Manual Run', branch: branch || 'main', template },
      {
        onSuccess: (pipeline) => {
          toast({ title: 'Pipeline queued', description: `"${pipeline.task_name}" is now running (${template} template).` });
          setTaskName('');
        },
        onError: () => {
          toast({ title: 'Failed to create pipeline', variant: 'destructive' });
        },
      },
    );
  }

  function handleCancel() {
    if (!activePipeline) return;
    cancelMutation.mutate(activePipeline.id, {
      onSuccess: () => toast({ title: 'Pipeline cancelled' }),
    });
  }

  function handleRetry() {
    if (!activePipeline) return;
    retryMutation.mutate(activePipeline.id, {
      onSuccess: () => toast({ title: 'Pipeline requeued for retry' }),
    });
  }

  function handleResume() {
    if (!activePipeline) return;
    resumeMutation.mutate(activePipeline.id, {
      onSuccess: () => toast({ title: 'Pipeline resumed from failed stage' }),
      onError:   () => toast({ title: 'Could not resume pipeline', variant: 'destructive' }),
    });
  }

  function handleRestart() {
    if (!activePipeline) return;
    restartMutation.mutate(activePipeline.id, {
      onSuccess: () => toast({ title: 'Pipeline restarted from the beginning' }),
      onError:   () => toast({ title: 'Could not restart pipeline', variant: 'destructive' }),
    });
  }

  function handleSkipStage(stage: string) {
    if (!activePipeline) return;
    skipStageMutation.mutate(
      { id: activePipeline.id, stage },
      {
        onSuccess: () => { toast({ title: `Stage "${stage}" skipped` }); setSkipStageTarget(null); },
        onError:   () => toast({ title: 'Could not skip stage', variant: 'destructive' }),
      },
    );
  }

  const completedStages = activePipeline?.logs?.filter((l) => l.status === 'success' || l.status === 'skipped').length ?? 0;
  const totalStages     = activePipeline?.logs?.length ?? 11;
  const progress        = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  const isFailed    = activePipeline?.status === 'failed';
  const isCancelled = activePipeline?.status === 'cancelled';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Release Manager
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Autonomous pipeline: Guardian → Build → Tests → Commit → Push → CI → Certification
            </p>
          </div>
          <Badge className={cn('text-xs border-0', activePipeline ? STATUS_BADGE[activePipeline.status].className : 'bg-muted text-muted-foreground')}>
            {activePipeline ? STATUS_BADGE[activePipeline.status].label : 'Idle'}
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* Launch Panel */}
        {!isPipelineRunning && (
          <section className="rounded-xl border border-border/60 bg-card p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              Launch Pipeline
            </h2>

            {/* Template selector */}
            {templates.length > 0 && (
              <div className="mb-4">
                <Label className="text-xs mb-2 block">Pipeline Template</Label>
                <div className="flex gap-2 flex-wrap">
                  {templates.map((t) => (
                    <button
                      key={t.slug}
                      type="button"
                      onClick={() => setTemplate(t.slug)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                        template === t.slug
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/60 text-muted-foreground hover:border-border',
                      )}
                    >
                      {t.name}
                      <span className="ml-1.5 opacity-60">{t.stage_count} stages</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Task Name</Label>
                <Input
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="e.g. TASK-ENG-007"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Branch</Label>
                <div className="relative">
                  <GitBranch className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="h-8 text-sm pl-7"
                  />
                </div>
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              size="sm"
              className="gap-2"
            >
              {createMutation.isPending
                ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                : <Play className="h-3.5 w-3.5" />}
              Start Pipeline
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              AUTO_DEPLOY=false — deployment stage will require manual approval.
            </p>
          </section>
        )}

        {/* Live Pipeline */}
        {activePipeline && (
          <section className="rounded-xl border border-border/60 bg-card overflow-hidden">
            {/* Pipeline header bar */}
            <div className={cn(
              'px-5 py-3 border-b border-border/60 flex items-center justify-between gap-4',
              activePipeline.status === 'running'   && 'bg-blue-50/60 dark:bg-blue-950/20',
              activePipeline.status === 'completed' && 'bg-green-50/60 dark:bg-green-950/20',
              activePipeline.status === 'failed'    && 'bg-red-50/60 dark:bg-red-950/20',
            )}>
              <div className="flex items-center gap-3 min-w-0">
                <div>
                  <p className="text-sm font-semibold truncate">{activePipeline.task_name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" /> {activePipeline.branch}
                    </span>
                    {activePipeline.commit_sha && (
                      <span className="flex items-center gap-1">
                        <GitCommit className="h-3 w-3" /> {activePipeline.commit_sha}
                      </span>
                    )}
                    {(activePipeline.status === 'running' || activePipeline.status === 'pending') ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> In progress…
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {activePipeline.duration_formatted}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {(activePipeline.status === 'running' || activePipeline.status === 'pending') && (
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelMutation.isPending} className="gap-1.5 h-7 text-xs">
                    <Ban className="h-3 w-3" /> Cancel
                  </Button>
                )}

                {isFailed && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleResume} disabled={resumeMutation.isPending} className="gap-1.5 h-7 text-xs">
                      <Play className="h-3 w-3" /> Resume
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRetry} disabled={retryMutation.isPending} className="gap-1.5 h-7 text-xs">
                      <RotateCcw className="h-3 w-3" /> Retry
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRestart} disabled={restartMutation.isPending} className="gap-1.5 h-7 text-xs text-muted-foreground">
                      <RefreshCw className="h-3 w-3" /> Restart
                    </Button>
                  </>
                )}

                {isCancelled && (
                  <Button variant="outline" size="sm" onClick={handleRestart} disabled={restartMutation.isPending} className="gap-1.5 h-7 text-xs">
                    <RefreshCw className="h-3 w-3" /> Restart
                  </Button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {(activePipeline.status === 'running' || activePipeline.status === 'pending') && (
              <div className="h-1 bg-muted/40">
                <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            )}

            {/* Error message */}
            {activePipeline.error_message && (
              <div className="px-5 py-2.5 bg-red-50 dark:bg-red-950/20 border-b border-border/60 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400">{activePipeline.error_message}</p>
              </div>
            )}

            {/* Stage timeline */}
            <div className="p-5">
              {activePipeline.logs && activePipeline.logs.length > 0 ? (
                <>
                  <PipelineStageTimeline
                    logs={activePipeline.logs}
                    currentStage={activePipeline.current_stage}
                  />

                  {/* Skip stage controls for failed pipelines */}
                  {isFailed && activePipeline.current_stage && (
                    <div className="mt-4 pt-4 border-t border-border/60">
                      {skipStageTarget === null ? (
                        <button
                          type="button"
                          onClick={() => setSkipStageTarget(activePipeline.current_stage ?? null)}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                        >
                          <SkipForward className="h-3.5 w-3.5" />
                          Skip failed stage and continue
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            Skip <strong>{skipStageTarget}</strong> and continue?
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs gap-1"
                            onClick={() => handleSkipStage(skipStageTarget)}
                            disabled={skipStageMutation.isPending}
                          >
                            <SkipForward className="h-3 w-3" /> Confirm Skip
                          </Button>
                          <button
                            type="button"
                            onClick={() => setSkipStageTarget(null)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Loading stage details...</p>
              )}
            </div>

            {/* Completed summary */}
            {activePipeline.status === 'completed' && (
              <div className="px-5 py-3 border-t border-border/60 bg-green-50/60 dark:bg-green-950/20 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  All stages passed — pipeline completed in {activePipeline.duration_formatted}.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Idle state */}
        {!activePipeline && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Zap className="h-10 w-10 opacity-20" />
            <p className="text-sm">No active pipeline. Start one above to begin the release process.</p>
          </div>
        )}

        {/* AUTO_DEPLOY notice */}
        <section className="rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/10 dark:border-amber-800/40 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">AUTO_DEPLOY = false</p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                Deployment to production requires manual approval. The Deployment Guardian stage will be automatically skipped.
                Set <code className="font-mono">ENGINEERING_AUTO_DEPLOY=true</code> in <code className="font-mono">.env</code> to enable automatic deployment.
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
