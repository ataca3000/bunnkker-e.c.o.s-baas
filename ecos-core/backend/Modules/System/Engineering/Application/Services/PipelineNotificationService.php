<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\EngineeringNotification;
use Modules\System\Engineering\Domain\Models\EngineeringPipeline;

class PipelineNotificationService
{
    public function pipelineStarted(EngineeringPipeline $pipeline): void
    {
        $this->create($pipeline, [
            'type'     => 'pipeline_started',
            'title'    => "Pipeline started — {$pipeline->task_name}",
            'message'  => "Release pipeline for task '{$pipeline->task_name}' has started on branch '{$pipeline->branch}'.",
            'severity' => 'info',
        ]);
    }

    public function pipelineCompleted(EngineeringPipeline $pipeline): void
    {
        $this->create($pipeline, [
            'type'     => 'pipeline_completed',
            'title'    => "Pipeline completed — {$pipeline->task_name}",
            'message'  => "All stages passed. Task '{$pipeline->task_name}' completed in {$pipeline->durationFormatted()}.",
            'severity' => 'success',
        ]);
    }

    public function pipelineFailed(EngineeringPipeline $pipeline, string $reason): void
    {
        $this->create($pipeline, [
            'type'     => 'pipeline_failed',
            'title'    => "Pipeline failed — {$pipeline->task_name}",
            'message'  => "Pipeline stopped at stage '{$pipeline->current_stage}'. Reason: {$reason}",
            'severity' => 'error',
            'metadata' => ['stage' => $pipeline->current_stage, 'reason' => $reason],
        ]);
    }

    public function certificationFailed(EngineeringPipeline $pipeline, int $score): void
    {
        $this->create($pipeline, [
            'type'     => 'certification_failed',
            'title'    => "Certification failed — score {$score}/100",
            'message'  => "Certification run for '{$pipeline->task_name}' scored {$score}/100. Pipeline halted.",
            'severity' => 'error',
            'metadata' => ['score' => $score],
        ]);
    }

    public function healthCheckFailed(EngineeringPipeline $pipeline, string $endpoint): void
    {
        $this->create($pipeline, [
            'type'     => 'health_check_failed',
            'title'    => "Health check failed — {$endpoint}",
            'message'  => "Health check failed for '{$endpoint}' after deploying '{$pipeline->task_name}'.",
            'severity' => 'error',
            'metadata' => ['endpoint' => $endpoint],
        ]);
    }

    public function deploymentPending(EngineeringPipeline $pipeline): void
    {
        $this->create($pipeline, [
            'type'     => 'deployment_pending',
            'title'    => "Deployment awaiting approval — {$pipeline->task_name}",
            'message'  => "Pipeline passed all checks. Manual approval required to deploy '{$pipeline->task_name}'. (AUTO_DEPLOY=false)",
            'severity' => 'warning',
        ]);
    }

    /** @param array{type:string, title:string, message:string, severity:string, metadata?:array<string,mixed>} $data */
    private function create(EngineeringPipeline $pipeline, array $data): void
    {
        EngineeringNotification::create([
            'pipeline_id' => $pipeline->id,
            'type'        => $data['type'],
            'title'       => $data['title'],
            'message'     => $data['message'],
            'severity'    => $data['severity'],
            'metadata'    => $data['metadata'] ?? null,
        ]);
    }
}
