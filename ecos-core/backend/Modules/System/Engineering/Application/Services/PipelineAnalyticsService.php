<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\System\Engineering\Domain\Models\EngineeringPipeline;
use Modules\System\Engineering\Domain\Models\EngineeringPipelineLog;

final class PipelineAnalyticsService
{
    /** @return array<string, mixed> */
    public function getDashboardMetrics(): array
    {
        $lookbackDays   = (int) config('engineering.analytics.lookback_days', 30);
        $recentCount    = (int) config('engineering.analytics.recent_pipelines', 10);
        $since          = now()->subDays($lookbackDays);

        $totals = EngineeringPipeline::where('created_at', '>=', $since)->get();

        $completed  = $totals->where('status', 'completed');
        $failed     = $totals->where('status', 'failed');
        $total      = $totals->count();

        $successRate = $total > 0 ? round(($completed->count() / $total) * 100, 1) : 0;
        $failureRate = $total > 0 ? round(($failed->count() / $total) * 100, 1) : 0;

        $avgDuration = $completed->avg('duration_seconds') ?? 0;

        // Slowest stage by average duration_seconds (across all logs in window)
        $slowestStage = EngineeringPipelineLog::select('stage', DB::raw('AVG(duration_seconds) as avg_seconds'))
            ->where('created_at', '>=', $since)
            ->where('status', 'success')
            ->whereNotNull('duration_seconds')
            ->groupBy('stage')
            ->orderByDesc('avg_seconds')
            ->first();

        // Total retry count in window
        $totalRetries = EngineeringPipelineLog::where('created_at', '>=', $since)
            ->sum('retry_count');

        // Stage duration breakdown
        $stageDurations = EngineeringPipelineLog::select('stage', DB::raw('AVG(duration_seconds) as avg_seconds'), DB::raw('MAX(duration_seconds) as max_seconds'), DB::raw('COUNT(*) as total_runs'))
            ->where('created_at', '>=', $since)
            ->where('status', 'success')
            ->whereNotNull('duration_seconds')
            ->groupBy('stage')
            ->get()
            ->keyBy('stage')
            ->map(fn ($row) => [
                'avg_seconds'  => (float) $row->avg_seconds,
                'max_seconds'  => (int) $row->max_seconds,
                'total_runs'   => (int) $row->total_runs,
            ])
            ->toArray();

        // Recent pipeline summary
        $recentPipelines = EngineeringPipeline::orderByDesc('created_at')
            ->limit($recentCount)
            ->get(['id', 'task_name', 'status', 'branch', 'duration_seconds', 'started_at', 'finished_at', 'initiated_by'])
            ->map(fn ($p) => [
                'id'               => $p->id,
                'task_name'        => $p->task_name,
                'status'           => $p->status,
                'branch'           => $p->branch,
                'duration_seconds' => $p->duration_seconds,
                'started_at'       => $p->started_at?->toISOString(),
                'finished_at'      => $p->finished_at?->toISOString(),
                'initiated_by'     => $p->initiated_by,
            ])
            ->values()
            ->toArray();

        return [
            'queue_size'            => EngineeringPipeline::where('status', 'pending')->count(),
            'running_count'         => EngineeringPipeline::where('status', 'running')->count(),
            'total_in_window'       => $total,
            'completed_count'       => $completed->count(),
            'failed_count'          => $failed->count(),
            'success_rate'          => $successRate,
            'failure_rate'          => $failureRate,
            'avg_duration_seconds'  => (float) round($avgDuration, 0),
            'total_retries'         => (int) $totalRetries,
            'slowest_stage'         => $slowestStage ? [
                'stage'       => $slowestStage->stage,
                'avg_seconds' => (float) round((float) $slowestStage->avg_seconds, 0),
            ] : null,
            'stage_durations'       => $stageDurations,
            'recent_pipelines'      => $recentPipelines,
            'lookback_days'         => $lookbackDays,
        ];
    }
}
