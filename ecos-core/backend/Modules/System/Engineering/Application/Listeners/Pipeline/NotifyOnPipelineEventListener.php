<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Listeners\Pipeline;

use Modules\System\Engineering\Application\Services\PipelineNotificationService;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineCancelled;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineCompleted;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineCreated;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineFailed;
use Modules\System\Engineering\Domain\Events\Pipeline\PipelineStarted;
use Modules\System\Engineering\Domain\Events\Pipeline\StageFailed;
use Modules\System\Engineering\Domain\Models\EngineeringPipeline;

/**
 * Converts pipeline domain events into EngineeringNotification records.
 *
 * This listener decouples event dispatch (in ReleasePipelineService) from
 * notification persistence (PipelineNotificationService), allowing future
 * channels (Email, Slack, WhatsApp) to subscribe independently.
 */
final class NotifyOnPipelineEventListener
{
    public function __construct(
        private readonly PipelineNotificationService $notifications,
    ) {}

    public function handlePipelineStarted(PipelineStarted $event): void
    {
        $pipeline = EngineeringPipeline::find($event->pipelineId);
        if ($pipeline) {
            $this->notifications->pipelineStarted($pipeline);
        }
    }

    public function handlePipelineCompleted(PipelineCompleted $event): void
    {
        $pipeline = EngineeringPipeline::find($event->pipelineId);
        if ($pipeline) {
            $this->notifications->pipelineCompleted($pipeline);
        }
    }

    public function handlePipelineFailed(PipelineFailed $event): void
    {
        $pipeline = EngineeringPipeline::find($event->pipelineId);
        if ($pipeline) {
            $this->notifications->pipelineFailed($pipeline, $event->errorMessage ?? "Stage {$event->failedStage} failed.");
        }
    }

    public function handleStageFailed(StageFailed $event): void
    {
        // Stage-level failures are handled by handlePipelineFailed.
        // Future: alert only if the stage matches a watch list (e.g. 'certification').
    }

    public function handlePipelineCreated(PipelineCreated $event): void
    {
        // No notification on create — too noisy. Future: configurable.
    }

    public function handlePipelineCancelled(PipelineCancelled $event): void
    {
        // No notification on cancel — user-initiated action.
    }
}
