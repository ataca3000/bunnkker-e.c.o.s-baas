<?php

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Collection;
use Modules\System\Engineering\Domain\Models\RepairHistory;
use Modules\System\Engineering\Domain\Models\RepairMetric;
use Modules\System\Engineering\Domain\Models\RepairSession;

class RepairAuditService
{
    /**
     * Argument order matches the module-wide call convention:
     * actor before data.
     */
    public function record(
        RepairSession $session,
        string $eventType,
        ?string $actorId = null,
        array $data = []
    ): void {
        RepairHistory::create([
            'session_id'  => $session->id,
            'company_id'  => $session->company_id,
            'event_type'  => $eventType,
            'event_data'  => empty($data) ? null : $data,
            'actor_id'    => $actorId,
            'occurred_at' => now(),
        ]);
    }

    public function getHistory(string $sessionId): Collection
    {
        return RepairHistory::where('session_id', $sessionId)
            ->orderBy('occurred_at', 'asc')
            ->get();
    }

    public function recordMetric(
        RepairSession|string $companyOrSession,
        string $type,
        string $key,
        float $value,
        array $dimensions = []
    ): void {
        $companyId = $companyOrSession instanceof RepairSession
            ? $companyOrSession->company_id
            : $companyOrSession;

        RepairMetric::create([
            'company_id'   => $companyId,
            'metric_type'  => $type,
            'metric_key'   => $key,
            'metric_value' => $value,
            'dimensions'   => empty($dimensions) ? null : $dimensions,
            'recorded_at'  => now(),
        ]);
    }

    public function getMetricTimeseries(
        string $companyId,
        string $type,
        string $key,
        int $days = 30
    ): Collection {
        return RepairMetric::where('company_id', $companyId)
            ->where('metric_type', $type)
            ->where('metric_key', $key)
            ->where('recorded_at', '>=', now()->subDays($days))
            ->orderBy('recorded_at')
            ->get(['metric_value', 'recorded_at']);
    }
}
