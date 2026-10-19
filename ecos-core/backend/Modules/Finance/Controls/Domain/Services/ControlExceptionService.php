<?php

declare(strict_types=1);

namespace Modules\Finance\Controls\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Finance\Controls\Domain\Models\ControlException;

/**
 * The exception register admin + control dashboard read model. Acknowledging or
 * resolving an exception is the only mutation here — the underlying financial
 * data is never touched.
 */
final class ControlExceptionService
{
    /** @return array<string, mixed> */
    public function dashboard(string $companyId): array
    {
        $open = ControlException::query()->where('company_id', $companyId)->where('status', 'open')->get();

        return [
            'open_total' => $open->count(),
            'by_severity' => $open->groupBy(fn ($e) => $e->severity->value)->map->count(),
            'by_category' => $open->groupBy('category')->map->count(),
            'critical_open' => $open->filter(fn ($e) => $e->severity->isBlocking())->count(),
            'exceptions' => $open->sortByDesc(fn ($e) => $e->severity->weight())->values()->map(fn ($e) => $this->payload($e)),
        ];
    }

    public function acknowledge(ControlException $exception, ?int $actorId = null): ControlException
    {
        if ($exception->status === 'open') {
            $exception->update(['status' => 'acknowledged', 'resolved_by' => $actorId]);
        }

        return $exception->refresh();
    }

    public function resolve(ControlException $exception, ?int $actorId = null): ControlException
    {
        $exception->update(['status' => 'resolved', 'resolved_by' => $actorId, 'resolved_at' => Carbon::now()]);

        return $exception->refresh();
    }

    /** @return array<string, mixed> */
    public function payload(ControlException $e): array
    {
        return [
            'id' => $e->uuid,
            'check_key' => $e->check_key,
            'category' => $e->category,
            'severity' => $e->severity->value,
            'entity_type' => $e->entity_type,
            'entity_id' => $e->entity_id,
            'message' => $e->message,
            'status' => $e->status,
            'detected_at' => $e->detected_at?->toIso8601String(),
        ];
    }
}
