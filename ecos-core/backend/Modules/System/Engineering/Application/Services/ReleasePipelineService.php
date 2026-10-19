<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Modules\System\Engineering\Domain\Enums\PipelineStage;
use Modules\System\Engineering\Domain\Enums\PipelineStatus;
use Modules\System\Engineering\Domain\Enums\StageStatus;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineCancelled;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineCompleted;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineCreated;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineFailed;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineStarted;
use Modules\System\Engineering\Domain\Events\Pipeline\StageCompleted;
use Modules\System\Engineering\Domain\Events\Pipeline\StageFailed;
use Modules\System\Engineering\Domain\Events\Pipeline\StageStarted;
use Modules\System\Engineering\Domain\Models\EngineeringPipeline;
use Modules\System\Engineering\Domain\Models\EngineeringPipelineLog;
use Modules\System\Engineering\Domain\ValueObjects\RetryPolicy;

class ReleasePipelineService
{
    public function __construct(
        private readonly PipelineStageExecutor  $executor,
        private readonly PipelineTemplateEngine $templateEngine,
        private readonly RetryPolicyFactory     $retryPolicyFactory,
    ) {}

    /**
     * Create a new pipeline and pre-create stage logs from the template.
     * Call dispatch(new ExecutePipelineJob($pipeline->id)) after this.
     *
     * @param array{task_name?:string, branch?:string, initiated_by?:string, initiated_by_user_id?:string|null, template?:string|null} $params
     */
    public function create(array $params = []): EngineeringPipeline
    {
        $templateSlug = $params['template'] ?? config('engineering.defaults.template', 'release');

        $pipeline = EngineeringPipeline::create([
            'id'                   => Str::uuid()->toString(),
            'task_name'            => $params['task_name'] ?? 'Manual Run',
            'branch'               => $params['branch'] ?? config('engineering.defaults.branch', 'main'),
            'status'               => PipelineStatus::Pending->value,
            'initiated_by'         => $params['initiated_by'] ?? 'Claude',
            'initiated_by_user_id' => $params['initiated_by_user_id'] ?? null,
            'auto_deploy'          => false,
            'template_slug'        => $templateSlug,
        ]);

        [$template] = $this->templateEngine->initializePipeline($pipeline, $templateSlug);

        if ($template !== null) {
            $pipeline->update(['template_id' => $template->id]);
        }

        Event::dispatch(new PipelineCreated(
            pipelineId:   $pipeline->id,
            taskName:     $pipeline->task_name,
            branch:       $pipeline->branch,
            initiatedBy:  $pipeline->initiated_by,
            templateSlug: $templateSlug,
        ));

        return $pipeline;
    }

    /**
     * Run all enabled stages of the pipeline synchronously.
     * Designed to be called from a queued Job.
     */
    public function run(string $pipelineId): void
    {
        $pipeline = EngineeringPipeline::with('logs')->find($pipelineId);

        if ($pipeline === null) {
            Log::error('ReleasePipelineService::run — pipeline not found', ['id' => $pipelineId]);
            return;
        }

        if ($pipeline->isTerminal()) {
            return;
        }

        $pipeline->update([
            'status'     => PipelineStatus::Running->value,
            'started_at' => $pipeline->started_at ?? now(),
        ]);

        Event::dispatch(new PipelineStarted(
            pipelineId:  $pipeline->id,
            taskName:    $pipeline->task_name,
            branch:      $pipeline->branch,
            initiatedBy: $pipeline->initiated_by,
        ));

        // Order logs by sort_order (template-aware), fall back to created_at
        $orderedLogs = $pipeline->logs
            ->sortBy(fn (EngineeringPipelineLog $l) => $l->sort_order ?? 999)
            ->values();

        foreach ($orderedLogs as $log) {
            // Skip stages already in terminal state (skipped via recovery, already succeeded on resume)
            if (in_array($log->status, [StageStatus::Success->value, StageStatus::Skipped->value, StageStatus::Cancelled->value], true)) {
                continue;
            }

            $stage = PipelineStage::tryFrom($log->stage);

            $pipeline->update(['current_stage' => $log->stage]);

            $log->update([
                'status'     => StageStatus::Running->value,
                'started_at' => now(),
            ]);

            Event::dispatch(new StageStarted(
                pipelineId: $pipeline->id,
                stage:      $log->stage,
                stageLabel: $log->stage_label ?? ($stage?->label() ?? $log->stage),
                retryCount: (int) ($log->retry_count ?? 0),
            ));

            $startTime = microtime(true);
            $success   = false;
            $retries   = 0;
            $policy    = $stage !== null
                ? $this->retryPolicyFactory->make($stage)
                : RetryPolicy::noRetry();

            while (true) {
                try {
                    $success = $stage !== null
                        ? $this->executor->execute($pipeline, $stage, $log)
                        : false;
                } catch (\Throwable $e) {
                    Log::error('Pipeline stage exception', [
                        'pipeline' => $pipelineId,
                        'stage'    => $log->stage,
                        'error'    => $e->getMessage(),
                    ]);
                    $log->update(['message' => ($log->message ?? '') . "\nException: " . $e->getMessage()]);
                    $success = false;
                }

                if ($success || $retries >= $policy->maxRetries) {
                    break;
                }

                $retries++;
                $log->update([
                    'status'      => StageStatus::Retrying->value,
                    'retry_count' => $retries,
                ]);

                $delay = $policy->calculateDelay($retries);
                if ($delay > 0) {
                    sleep($delay);
                }
            }

            // Re-read after executor may have set Skipped
            $log->refresh();

            $elapsed     = (int) round(microtime(true) - $startTime);
            $finalStatus = $log->status === StageStatus::Skipped->value
                ? StageStatus::Skipped
                : ($success ? StageStatus::Success : StageStatus::Failed);

            $log->update([
                'status'           => $finalStatus->value,
                'finished_at'      => now(),
                'duration_seconds' => $elapsed,
            ]);

            if ($finalStatus === StageStatus::Success || $finalStatus === StageStatus::Skipped) {
                Event::dispatch(new StageCompleted(
                    pipelineId:      $pipeline->id,
                    stage:           $log->stage,
                    stageLabel:      $log->stage_label ?? ($stage?->label() ?? $log->stage),
                    skipped:         $finalStatus === StageStatus::Skipped,
                    durationSeconds: $elapsed,
                    retryCount:      $retries,
                ));
            } else {
                Event::dispatch(new StageFailed(
                    pipelineId:      $pipeline->id,
                    stage:           $log->stage,
                    stageLabel:      $log->stage_label ?? ($stage?->label() ?? $log->stage),
                    errorMessage:    $log->message,
                    retryCount:      $retries,
                    durationSeconds: $elapsed,
                ));

                $this->failPipeline($pipeline, $log->message ?? "Stage {$log->stage} failed.");
                return;
            }
        }

        $finished = now();
        $duration = abs((int) $finished->diffInSeconds($pipeline->started_at ?? $finished));

        $pipeline->update([
            'status'           => PipelineStatus::Completed->value,
            'current_stage'    => null,
            'finished_at'      => $finished,
            'duration_seconds' => $duration,
        ]);

        Event::dispatch(new PipelineCompleted(
            pipelineId:      $pipeline->id,
            taskName:        $pipeline->task_name,
            branch:          $pipeline->branch,
            durationSeconds: $duration,
            commitSha:       $pipeline->commit_sha,
        ));
    }

    public function cancel(string $pipelineId): bool
    {
        $pipeline = EngineeringPipeline::find($pipelineId);

        if ($pipeline === null || $pipeline->isTerminal()) {
            return false;
        }

        $pipeline->update([
            'status'      => PipelineStatus::Cancelled->value,
            'finished_at' => now(),
        ]);

        $pipeline->logs()
            ->whereIn('status', [StageStatus::Pending->value, StageStatus::Running->value])
            ->update(['status' => StageStatus::Cancelled->value]);

        Event::dispatch(new PipelineCancelled(
            pipelineId:     $pipeline->id,
            taskName:       $pipeline->task_name,
            branch:         $pipeline->branch,
            cancelledStage: $pipeline->current_stage,
            cancelledBy:    'user',
        ));

        return true;
    }

    public function retry(string $pipelineId): bool
    {
        $pipeline = EngineeringPipeline::find($pipelineId);

        if ($pipeline === null || $pipeline->status !== PipelineStatus::Failed->value) {
            return false;
        }

        $failedStage = $pipeline->current_stage;
        $stages      = PipelineStage::orderedStages();
        $resetFrom   = false;

        foreach ($stages as $stage) {
            if ($stage->value === $failedStage) {
                $resetFrom = true;
            }

            if ($resetFrom) {
                $pipeline->logs()->where('stage', $stage->value)->update([
                    'status'           => StageStatus::Pending->value,
                    'started_at'       => null,
                    'finished_at'      => null,
                    'duration_seconds' => null,
                    'message'          => null,
                    'payload'          => null,
                    'retry_count'      => 0,
                ]);
            }
        }

        $pipeline->update([
            'status'        => PipelineStatus::Pending->value,
            'error_message' => null,
        ]);

        return true;
    }

    private function failPipeline(EngineeringPipeline $pipeline, string $reason): void
    {
        $finished = now();
        $duration = abs((int) $finished->diffInSeconds($pipeline->started_at ?? $finished));

        $pipeline->update([
            'status'           => PipelineStatus::Failed->value,
            'finished_at'      => $finished,
            'error_message'    => $reason,
            'duration_seconds' => $duration,
        ]);

        Event::dispatch(new PipelineFailed(
            pipelineId:      $pipeline->id,
            taskName:        $pipeline->task_name,
            branch:          $pipeline->branch,
            failedStage:     $pipeline->current_stage ?? 'unknown',
            errorMessage:    $reason,
            durationSeconds: $duration,
        ));
    }
}
