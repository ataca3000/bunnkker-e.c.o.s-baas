<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Modules\Core\BusinessAttribution\Domain\Models\ReplayAuditLog;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\ReplayContext;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\ReplayResult;

class ReplayAuditService
{
    public function log(
        ReplayContext $context,
        ReplayResult $result,
        string $status = 'completed',
        ?string $userId = null,
    ): ReplayAuditLog {
        return ReplayAuditLog::create([
            'user_id' => $userId ?? $context->userId,
            'user_type' => 'user',
            'target_entity_type' => $context->entityType !== 'module' ? $context->entityType : null,
            'target_entity_id' => $context->entityType !== 'module' ? $context->entityId : null,
            'replay_type' => $context->replayType,
            'replay_from' => $context->from,
            'replay_to' => $context->to,
            'replay_as_of' => $context->asOf,
            'replay_purpose' => $context->purpose ?: null,
            'events_replayed' => $result->totalEvents,
            'duration_ms' => $result->durationMs,
            'status' => $status,
            'metadata' => $result->metadata ?: null,
        ]);
    }

    public function list(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        $query = ReplayAuditLog::query()->orderByDesc('executed_at');

        if (! empty($filters['entity_type'])) {
            $query->where('target_entity_type', $filters['entity_type']);
        }
        if (! empty($filters['entity_id'])) {
            $query->where('target_entity_id', $filters['entity_id']);
        }
        if (! empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }
        if (! empty($filters['replay_type'])) {
            $query->where('replay_type', $filters['replay_type']);
        }
        if (! empty($filters['date_from'])) {
            $query->where('executed_at', '>=', $filters['date_from']);
        }
        if (! empty($filters['date_to'])) {
            $query->where('executed_at', '<=', $filters['date_to']);
        }

        return $query->paginate($perPage);
    }

    public function getForEntity(string $entityType, string $entityId): Collection
    {
        return ReplayAuditLog::query()
            ->where('target_entity_type', $entityType)
            ->where('target_entity_id', $entityId)
            ->orderByDesc('executed_at')
            ->limit(50)
            ->get();
    }

    public function getStats(): array
    {
        $total = ReplayAuditLog::count();
        $today = ReplayAuditLog::whereDate('executed_at', today())->count();
        $byType = ReplayAuditLog::selectRaw('replay_type, count(*) as cnt')
            ->groupBy('replay_type')
            ->pluck('cnt', 'replay_type')
            ->toArray();
        $avgDuration = ReplayAuditLog::whereNotNull('duration_ms')->avg('duration_ms');

        return [
            'total' => $total,
            'today' => $today,
            'by_type' => $byType,
            'avg_duration_ms' => (int) ($avgDuration ?? 0),
        ];
    }
}
