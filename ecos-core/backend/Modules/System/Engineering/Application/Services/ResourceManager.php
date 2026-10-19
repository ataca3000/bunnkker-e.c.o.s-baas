<?php

declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Process;
use Modules\System\Engineering\Domain\Models\EngineeringClusterMetric;
use Modules\System\Engineering\Domain\Models\EngineeringExecutionQueue;
use Modules\System\Engineering\Domain\Models\EngineeringResourceUsage;
use Modules\System\Engineering\Domain\Models\EngineeringWorker;
use Modules\System\Engineering\Domain\Models\EngineeringWorkerRuntime;
use Modules\System\Engineering\Domain\Models\EngineeringWorkerSession;

final class ResourceManager
{
    public function collectSnapshot(string $companyId): EngineeringResourceUsage
    {
        $cpu  = $this->getCurrentCpuPercent();
        $mem  = $this->getCurrentMemoryMb();
        $disk = $this->getCurrentDiskGb();

        $active  = EngineeringWorker::where('company_id', $companyId)
            ->whereIn('status', ['preparing', 'running', 'paused', 'reserved'])->count();
        $idle    = EngineeringWorker::where('company_id', $companyId)
            ->whereIn('status', ['idle', 'waiting'])->count();
        $failed  = EngineeringWorker::where('company_id', $companyId)
            ->where('status', 'failed')->count();
        $qLen    = EngineeringExecutionQueue::where('company_id', $companyId)
            ->where('status', 'pending')->count();
        $running = EngineeringWorkerSession::where('company_id', $companyId)
            ->where('status', 'running')->count();
        $paused  = EngineeringWorkerSession::where('company_id', $companyId)
            ->where('status', 'paused')->count();

        $total       = $active + $idle + $failed;
        $utilization = $total > 0 ? round($active / $total * 100, 2) : 0.0;

        $usage = EngineeringResourceUsage::create([
            'company_id'                  => $companyId,
            'cpu_percent'                 => $cpu,
            'memory_mb_used'              => $mem,
            'disk_gb_used'                => $disk,
            'active_workers'              => $active,
            'idle_workers'                => $idle,
            'failed_workers'              => $failed,
            'queue_length'                => $qLen,
            'running_sessions'            => $running,
            'paused_sessions'             => $paused,
            'cluster_utilization_percent' => $utilization,
            'recorded_at'                 => now(),
        ]);

        $this->persistMetric($companyId, 'cpu', $cpu, 'percent');
        $this->persistMetric($companyId, 'memory_mb_used', (float) $mem, 'mb');
        $this->persistMetric($companyId, 'workers_active', (float) $active, 'count');
        $this->persistMetric($companyId, 'queue_length', (float) $qLen, 'count');

        return $usage;
    }

    public function canStartNewSession(string $companyId, array $limits = []): bool
    {
        $maxWorkers = $limits['max_workers'] ?? 10;
        $maxCpu     = $limits['max_cpu_percent'] ?? 85.0;

        $active = EngineeringWorker::where('company_id', $companyId)
            ->whereIn('status', ['running', 'preparing'])->count();

        if ($active >= $maxWorkers) {
            return false;
        }

        if ($this->getCurrentCpuPercent() > $maxCpu) {
            return false;
        }

        return true;
    }

    public function recordWorkerMetric(
        string $workerId,
        string $metricKey,
        float $value,
        string $unit = '',
        ?string $sessionId = null
    ): void {
        EngineeringWorkerRuntime::create([
            'worker_id'    => $workerId,
            'session_id'   => $sessionId,
            'metric_key'   => $metricKey,
            'metric_value' => $value,
            'metric_unit'  => $unit,
            'recorded_at'  => now(),
        ]);
    }

    public function getLatestSnapshot(string $companyId): ?EngineeringResourceUsage
    {
        return EngineeringResourceUsage::where('company_id', $companyId)
            ->latest('recorded_at')->first();
    }

    public function getTrend(string $companyId, int $limit = 60): Collection
    {
        return EngineeringResourceUsage::where('company_id', $companyId)
            ->orderByDesc('recorded_at')
            ->limit($limit)
            ->get()
            ->reverse()
            ->values();
    }

    public function getMetricTimeseries(string $companyId, string $metricType, int $minutes = 60): Collection
    {
        return EngineeringClusterMetric::where('company_id', $companyId)
            ->where('metric_type', $metricType)
            ->where('recorded_at', '>=', now()->subMinutes($minutes))
            ->orderBy('recorded_at')
            ->get();
    }

    public function purgeOldRecords(string $companyId, int $retentionDays = 30): int
    {
        $cut = now()->subDays($retentionDays);
        return EngineeringResourceUsage::where('company_id', $companyId)->where('recorded_at', '<', $cut)->delete()
             + EngineeringClusterMetric::where('company_id', $companyId)->where('recorded_at', '<', $cut)->delete();
    }

    private function persistMetric(string $companyId, string $type, float $value, string $unit): void
    {
        EngineeringClusterMetric::create([
            'company_id'  => $companyId,
            'metric_type' => $type,
            'value'       => $value,
            'unit'        => $unit,
            'recorded_at' => now(),
        ]);
    }

    private function getCurrentCpuPercent(): float
    {
        if (PHP_OS_FAMILY === 'Linux') {
            $load  = sys_getloadavg();
            $cores = max(1, (int) (shell_exec('nproc 2>/dev/null') ?? '1'));
            return round(min(100.0, ($load[0] / $cores) * 100), 2);
        }
        return 0.0;
    }

    private function getCurrentMemoryMb(): int
    {
        if (PHP_OS_FAMILY === 'Linux') {
            $result = Process::run(['free', '-m']);
            if ($result->successful() && preg_match('/Mem:\s+\d+\s+(\d+)/', $result->output(), $m)) {
                return (int) $m[1];
            }
        }
        return (int) (memory_get_usage(true) / 1024 / 1024);
    }

    private function getCurrentDiskGb(): float
    {
        $free  = disk_free_space('/');
        $total = disk_total_space('/');
        if ($free === false || $total === false) {
            return 0.0;
        }
        return round(($total - $free) / 1073741824, 2);
    }
}
