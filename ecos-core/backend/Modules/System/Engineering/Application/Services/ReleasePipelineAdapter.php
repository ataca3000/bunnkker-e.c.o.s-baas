<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;
use Illuminate\Support\Facades\DB;
use Modules\System\Engineering\Domain\Enums\ReleaseStatus;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleasePackage;
use Modules\System\Engineering\Domain\Models\EngineeringReleasePipelineRun;

final class ReleasePipelineAdapter
{
    public function __construct(private readonly ReleaseAuditService $audit) {}

    public function buildPackage(EngineeringRelease $release): EngineeringReleasePackage
    {
        $manifest = [
            'release_id'         => $release->id,
            'name'               => $release->name,
            'version'            => $release->version,
            'task_ids'           => $release->task_ids,
            'task_count'         => $release->task_count,
            'target_environment' => $release->target_environment,
            'is_breaking_change' => $release->is_breaking_change,
            'readiness_score'    => $release->readiness_score,
            'risk_level'         => $release->risk_level->value,
            'artifacts'          => $release->artifacts()->pluck('file_path', 'name')->toArray(),
            'reports'            => $release->reports()->pluck('report_type')->toArray(),
            'built_at'           => now()->toIsoString(),
        ];

        return EngineeringReleasePackage::updateOrCreate(
            ['release_id' => $release->id, 'package_type' => 'standard'],
            [
                'company_id'       => $release->company_id,
                'manifest'         => $manifest,
                'metadata_payload' => ['generator' => 'ReleasePipelineAdapter', 'version' => '1.0'],
                'status'           => 'ready',
                'built_at'         => now(),
            ]
        );
    }

    public function triggerPipeline(EngineeringRelease $release, ?string $triggeredBy = null, string $triggerType = 'manual'): EngineeringReleasePipelineRun
    {
        return DB::transaction(function () use ($release, $triggeredBy, $triggerType) {
            $package = $this->buildPackage($release);

            $pipelineRunId = 'eng-release-' . $release->id . '-' . now()->format('YmdHis');

            $run = EngineeringReleasePipelineRun::create([
                'company_id'      => $release->company_id,
                'release_id'      => $release->id,
                'pipeline_run_id' => $pipelineRunId,
                'pipeline_type'   => 'release',
                'status'          => 'pending',
                'trigger_type'    => $triggerType,
                'triggered_by'    => $triggeredBy,
                'environment'     => $release->target_environment,
                'pipeline_config' => [
                    'package_id' => $package->id,
                    'manifest'   => $package->manifest,
                    'release_id' => $release->id,
                ],
                'started_at' => now(),
            ]);

            $release->update([
                'status'              => ReleaseStatus::PipelineRunning->value,
                'pipeline_run_id'     => $pipelineRunId,
                'pipeline_status'     => 'running',
                'pipeline_started_at' => now(),
            ]);

            $this->audit->record($release, 'pipeline_triggered', $triggeredBy, ReleaseStatus::Queued->value, ReleaseStatus::PipelineRunning->value, "Pipeline run [{$pipelineRunId}] started");

            return $run;
        });
    }

    public function capturePipelineResult(
        EngineeringReleasePipelineRun $run,
        string $status,
        ?string $logs = null,
        ?array $result = null,
        ?int $exitCode = null
    ): void {
        DB::transaction(function () use ($run, $status, $logs, $result, $exitCode) {
            $run->update([
                'status'         => $status,
                'logs'           => $logs,
                'result_payload' => $result,
                'exit_code'      => $exitCode,
                'finished_at'    => now(),
            ]);

            $release = $run->release;
            $newStatus = $status === 'success'
                ? ReleaseStatus::Released
                : ReleaseStatus::PipelineFailed;

            $release->update([
                'status'          => $newStatus->value,
                'pipeline_status' => $status,
                'released_at'     => $status === 'success' ? now() : null,
            ]);

            $this->audit->record(
                $release, 'pipeline_result',
                null,
                ReleaseStatus::PipelineRunning->value,
                $newStatus->value,
                "Pipeline [{$run->pipeline_run_id}] finished with status: {$status}"
            );
        });
    }

    public function getPipelineHistory(EngineeringRelease $release): \Illuminate\Support\Collection
    {
        return EngineeringReleasePipelineRun::where('release_id', $release->id)->orderByDesc('created_at')->get();
    }
}
