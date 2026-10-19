<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Application\Services;
use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseAudit;
use Modules\System\Engineering\Domain\Models\EngineeringReleaseMetric;

final class ReleaseAuditService
{
    public function record(
        EngineeringRelease $release,
        string $eventType,
        ?string $actorId = null,
        ?string $fromStatus = null,
        ?string $toStatus = null,
        string $description = '',
        array $payload = []
    ): EngineeringReleaseAudit {
        return EngineeringReleaseAudit::create([
            'company_id'  => $release->company_id,
            'release_id'  => $release->id,
            'event_type'  => $eventType,
            'actor_id'    => $actorId,
            'from_status' => $fromStatus,
            'to_status'   => $toStatus,
            'description' => $description,
            'payload'     => $payload ?: null,
            'occurred_at' => now(),
        ]);
    }

    public function getHistory(string $releaseId, int $limit = 100): \Illuminate\Support\Collection
    {
        return EngineeringReleaseAudit::where('release_id', $releaseId)
            ->orderByDesc('occurred_at')
            ->limit($limit)
            ->get();
    }

    public function recordMetric(string $companyId, string $releaseId, string $type, string $key, float $value, string $unit = '', array $breakdown = []): void
    {
        EngineeringReleaseMetric::create([
            'company_id'  => $companyId,
            'release_id'  => $releaseId,
            'metric_type' => $type,
            'metric_key'  => $key,
            'value'       => $value,
            'unit'        => $unit,
            'breakdown'   => $breakdown ?: null,
            'recorded_at' => now(),
        ]);
    }

    public function getMetrics(string $releaseId): array
    {
        return EngineeringReleaseMetric::where('release_id', $releaseId)
            ->get()
            ->groupBy('metric_type')
            ->toArray();
    }
}
