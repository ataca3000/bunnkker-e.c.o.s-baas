<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Enums\WorkerStatus;
use Modules\System\Engineering\Domain\Models\EngineeringExecutionQueue;
use Modules\System\Engineering\Domain\Models\EngineeringWorker;

final class ClusterHealthService
{
    public function __construct(
        private readonly ResourceManager $resourceManager,
    ) {}

    public function getHealthReport(string $companyId): array
    {
        $workers     = EngineeringWorker::where('company_id', $companyId)->get();
        $staleCutoff = now()->subMinutes(5);

        $stale  = $workers->filter(fn($w) => $w->status->isActive() && $w->last_heartbeat_at < $staleCutoff);
        $failed = $workers->where('status', WorkerStatus::Failed->value);

        $snapshot = $this->resourceManager->collectSnapshot($companyId);

        $cpuAlert    = $snapshot->cpu_percent > 90;
        $memAlert    = $snapshot->memory_mb_used > 14336; // >14 GB
        $workerAlert = $stale->count() > 0 || $failed->count() > 0;

        $status = 'healthy';
        if ($cpuAlert || $memAlert) {
            $status = 'degraded';
        }
        if ($workerAlert && $failed->count() > 2) {
            $status = 'critical';
        }

        return [
            'status'    => $status,
            'workers'   => [
                'total'   => $workers->count(),
                'healthy' => $workers->count() - $stale->count() - $failed->count(),
                'stale'   => $stale->count(),
                'failed'  => $failed->count(),
            ],
            'resources' => [
                'cpu_percent'                 => $snapshot->cpu_percent,
                'memory_mb_used'              => $snapshot->memory_mb_used,
                'disk_gb_used'                => $snapshot->disk_gb_used,
                'cluster_utilization_percent' => $snapshot->cluster_utilization_percent,
            ],
            'alerts'    => [
                'cpu_high'       => $cpuAlert,
                'memory_high'    => $memAlert,
                'stale_workers'  => $stale->count(),
                'failed_workers' => $failed->count(),
            ],
            'queue'      => [
                'pending' => EngineeringExecutionQueue::where('company_id', $companyId)->where('status', 'pending')->count(),
            ],
            'checked_at' => now()->toIsoString(),
        ];
    }

    public function checkWorkerHealth(EngineeringWorker $worker): array
    {
        $stale   = $worker->last_heartbeat_at < now()->subMinutes(5);
        $latency = $worker->last_heartbeat_at ? now()->diffInSeconds($worker->last_heartbeat_at) : null;

        return [
            'worker_id'             => $worker->id,
            'status'                => $worker->status->value,
            'is_stale'              => $stale,
            'heartbeat_seconds_ago' => $latency,
            'is_healthy'            => !$stale && $worker->status->isActive(),
            'current_task_id'       => $worker->current_task_id,
        ];
    }
}
