<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Facades\Log;
use Modules\System\Engineering\Domain\Enums\PipelineStage;
use Modules\System\Engineering\Domain\Enums\PipelineStatus;
use Modules\System\Engineering\Domain\Enums\StageStatus;
use Modules\System\Engineering\Domain\Models\EngineeringPipeline;
use Modules\System\Engineering\Infrastructure\Jobs\ExecutePipelineJob;

final class PipelineRecoveryService
{
    /**
     * Resume a failed pipeline from the failed stage.
     * Identical to retry but keeps original started_at for duration tracking.
     */
    public function resume(string $pipelineId): bool
    {
        $pipeline = EngineeringPipeline::find($pipelineId);

        if ($pipeline === null || $pipeline->status !== PipelineStatus::Failed->value) {
            return false;
        }

        $failedStage = $pipeline->current_stage;
        $this->resetFrom($pipeline, $failedStage);

        $pipeline->update([
            'status'        => PipelineStatus::Pending->value,
            'error_message' => null,
        ]);

        ExecutePipelineJob::dispatch($pipeline->id);

        Log::info('Pipeline resumed', ['pipeline_id' => $pipelineId, 'from_stage' => $failedStage]);
        return true;
    }

    /**
     * Restart pipeline from scratch — reset all stages.
     */
    public function restartPipeline(string $pipelineId): bool
    {
        $pipeline = EngineeringPipeline::find($pipelineId);

        if ($pipeline === null || ! in_array($pipeline->status, [PipelineStatus::Failed->value, PipelineStatus::Cancelled->value, PipelineStatus::Completed->value], true)) {
            return false;
        }

        // Reset every stage log
        $pipeline->logs()->update([
            'status'           => StageStatus::Pending->value,
            'started_at'       => null,
            'finished_at'      => null,
            'duration_seconds' => null,
            'message'          => null,
            'payload'          => null,
            'retry_count'      => 0,
        ]);

        $pipeline->update([
            'status'           => PipelineStatus::Pending->value,
            'current_stage'    => null,
            'error_message'    => null,
            'started_at'       => null,
            'finished_at'      => null,
            'duration_seconds' => null,
            'commit_sha'       => null,
        ]);

        ExecutePipelineJob::dispatch($pipeline->id);

        Log::info('Pipeline restarted from scratch', ['pipeline_id' => $pipelineId]);
        return true;
    }

    /**
     * Restart pipeline from a specific stage (reset that stage and all after it).
     */
    public function restartStage(string $pipelineId, string $stageName): bool
    {
        $pipeline = EngineeringPipeline::with('logs')->find($pipelineId);

        if ($pipeline === null || ! in_array($pipeline->status, [PipelineStatus::Failed->value, PipelineStatus::Cancelled->value], true)) {
            return false;
        }

        // Validate the stage exists in this pipeline's logs
        $stageLog = $pipeline->logs->firstWhere('stage', $stageName);
        if ($stageLog === null) {
            return false;
        }

        $this->resetFrom($pipeline, $stageName);

        $pipeline->update([
            'status'        => PipelineStatus::Pending->value,
            'error_message' => null,
        ]);

        ExecutePipelineJob::dispatch($pipeline->id);

        Log::info('Pipeline stage restarted', ['pipeline_id' => $pipelineId, 'stage' => $stageName]);
        return true;
    }

    /**
     * Mark a stage as skipped, then re-dispatch so pipeline continues from the next stage.
     */
    public function skipStage(string $pipelineId, string $stageName): bool
    {
        $pipeline = EngineeringPipeline::with('logs')->find($pipelineId);

        if ($pipeline === null || ! in_array($pipeline->status, [PipelineStatus::Failed->value, PipelineStatus::Cancelled->value, PipelineStatus::Running->value], true)) {
            return false;
        }

        $stageLog = $pipeline->logs->firstWhere('stage', $stageName);
        if ($stageLog === null) {
            return false;
        }

        // Mark the stage as skipped
        $stageLog->update([
            'status'      => StageStatus::Skipped->value,
            'message'     => 'Stage skipped via manual recovery action.',
            'finished_at' => now(),
        ]);

        // If pipeline is in failed state, reset to pending and re-dispatch
        if ($pipeline->status === PipelineStatus::Failed->value) {
            // Also reset any stages after the skipped one that are in failed state
            $this->resetAfter($pipeline, $stageName);

            $pipeline->update([
                'status'        => PipelineStatus::Pending->value,
                'error_message' => null,
            ]);

            ExecutePipelineJob::dispatch($pipeline->id);
        }

        Log::info('Pipeline stage skipped', ['pipeline_id' => $pipelineId, 'stage' => $stageName]);
        return true;
    }

    /**
     * Reset the given stage and all subsequent stages to pending.
     */
    private function resetFrom(EngineeringPipeline $pipeline, ?string $fromStageName): void
    {
        if ($fromStageName === null) {
            return;
        }

        $stages       = PipelineStage::orderedStages();
        $stageValues  = array_map(fn ($s) => $s->value, $stages);
        $fromIndex    = array_search($fromStageName, $stageValues, true);

        if ($fromIndex === false) {
            // Not a known PipelineStage enum — fall back to DB log ordering
            $allLogStages = $pipeline->logs()->orderBy('sort_order')->pluck('stage')->toArray();
            $fromIndex    = array_search($fromStageName, $allLogStages, true);
            $stageValues  = $allLogStages;
        }

        if ($fromIndex === false) {
            return;
        }

        $toReset = array_slice($stageValues, (int) $fromIndex);

        $pipeline->logs()
            ->whereIn('stage', $toReset)
            ->update([
                'status'           => StageStatus::Pending->value,
                'started_at'       => null,
                'finished_at'      => null,
                'duration_seconds' => null,
                'message'          => null,
                'payload'          => null,
                'retry_count'      => 0,
            ]);
    }

    /**
     * Reset all stages that come AFTER the given stage to pending.
     */
    private function resetAfter(EngineeringPipeline $pipeline, string $afterStageName): void
    {
        $stages      = PipelineStage::orderedStages();
        $stageValues = array_map(fn ($s) => $s->value, $stages);
        $afterIndex  = array_search($afterStageName, $stageValues, true);

        if ($afterIndex === false) {
            return;
        }

        $toReset = array_slice($stageValues, (int) $afterIndex + 1);

        if (empty($toReset)) {
            return;
        }

        $pipeline->logs()
            ->whereIn('stage', $toReset)
            ->whereIn('status', [StageStatus::Failed->value, StageStatus::Cancelled->value])
            ->update([
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
