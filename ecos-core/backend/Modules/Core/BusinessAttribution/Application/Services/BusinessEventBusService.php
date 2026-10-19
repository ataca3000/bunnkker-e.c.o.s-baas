<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Services;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;

/**
 * Business Event Bus — the foundation of the BAE.
 * Modules publish Business Events here; consumers query here.
 * This is NOT a message queue — it is an enterprise event store.
 */
final class BusinessEventBusService
{
    /**
     * Publish a standardized Business Event.
     *
     * @param  array<string, mixed>  $data
     */
    public function publish(array $data): BusinessEvent
    {
        return BusinessEvent::create([
            'id' => Str::uuid()->toString(),
            'event_uuid' => Str::uuid()->toString(),
            'event_name' => $data['event_name'],
            'category' => $data['category'],
            'producer_module' => $data['producer_module'],
            'producer_entity' => $data['producer_entity'],
            'entity_id' => $data['entity_id'] ?? null,
            'entity_type' => $data['entity_type'] ?? null,
            'company_id' => $data['company_id'] ?? null,
            'brand_id' => $data['brand_id'] ?? null,
            'channel_id' => $data['channel_id'] ?? null,
            'warehouse_id' => $data['warehouse_id'] ?? null,
            'business_unit' => $data['business_unit'] ?? null,
            'cost_center' => $data['cost_center'] ?? null,
            'actor_id' => $data['actor_id'] ?? null,
            'actor_type' => $data['actor_type'] ?? null,
            'occurred_at' => $data['occurred_at'] ?? Carbon::now(),
            'correlation_id' => $data['correlation_id'] ?? null,
            'business_dna_id' => $data['business_dna_id'] ?? null,
            'payload' => $data['payload'] ?? [],
            'metadata' => $data['metadata'] ?? null,
            'version' => $data['version'] ?? '1.0',
            'created_at' => Carbon::now(),
        ]);
    }

    /** Query events scoped to a specific business DNA ID. */
    public function getByDna(string $dnaId, int $perPage = 25): LengthAwarePaginator
    {
        return BusinessEvent::where('business_dna_id', $dnaId)
            ->orderByDesc('occurred_at')
            ->paginate($perPage);
    }

    /** Query events by correlation ID (traces a distributed operation). */
    public function getByCorrelation(string $correlationId): \Illuminate\Support\Collection
    {
        return BusinessEvent::where('correlation_id', $correlationId)
            ->orderBy('occurred_at')
            ->get();
    }

    /** Query events scoped to an entity (e.g., all events for Order X). */
    public function getByEntity(string $entityType, string $entityId, int $perPage = 25): LengthAwarePaginator
    {
        return BusinessEvent::where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->orderByDesc('occurred_at')
            ->paginate($perPage);
    }

    /**
     * Cross-module timeline: paginated events with optional filters.
     *
     * @param  array{
     *   company_id?: string|null,
     *   category?: string|null,
     *   producer_module?: string|null,
     *   date_from?: string|null,
     *   date_to?: string|null,
     *   search?: string|null,
     * } $filters
     */
    public function timeline(array $filters = [], int $perPage = 50): LengthAwarePaginator
    {
        $query = BusinessEvent::query()->orderByDesc('occurred_at');

        if (! empty($filters['company_id'])) {
            $query->where('company_id', $filters['company_id']);
        }
        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }
        if (! empty($filters['producer_module'])) {
            $query->where('producer_module', $filters['producer_module']);
        }
        if (! empty($filters['date_from'])) {
            $query->where('occurred_at', '>=', $filters['date_from']);
        }
        if (! empty($filters['date_to'])) {
            $query->where('occurred_at', '<=', $filters['date_to']);
        }
        if (! empty($filters['search'])) {
            $query->where(static function (Builder $q) use ($filters): void {
                $q->where('event_name', 'like', "%{$filters['search']}%")
                    ->orWhere('producer_module', 'like', "%{$filters['search']}%");
            });
        }

        return $query->paginate($perPage);
    }
}
