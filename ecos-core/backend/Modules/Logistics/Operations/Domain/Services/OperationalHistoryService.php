<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Modules\Logistics\Dispatch\Domain\Models\DispatchSession;
use Modules\Logistics\Dispatch\Domain\Models\ResourceAllocation;
use Modules\Logistics\Operations\Domain\Models\CapacityReservation;

/**
 * The history surfaces — assignments, sessions and capacity over time.
 *
 * Every method is a filtered read over a table another module owns and writes.
 * Nothing here mutates: history is the record as those modules left it, and a
 * history screen that could edit the past would not be a history at all.
 */
class OperationalHistoryService
{
    /**
     * Assignment history — every allocation Dispatch made, newest first.
     *
     * @param  array<string, mixed>  $filters  company_id, status, mode, from, to
     */
    public function assignments(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        return ResourceAllocation::query()
            ->when(($filters['company_id'] ?? null) !== null, fn ($q) => $q->where('company_id', $filters['company_id']))
            ->when(($filters['status'] ?? null) !== null, fn ($q) => $q->where('status', $filters['status']))
            ->when(($filters['mode'] ?? null) !== null, fn ($q) => $q->where('allocation_mode', $filters['mode']))
            ->when(($filters['from'] ?? null) !== null, fn ($q) => $q->where('allocated_at', '>=', Carbon::parse($filters['from'])))
            ->when(($filters['to'] ?? null) !== null, fn ($q) => $q->where('allocated_at', '<=', Carbon::parse($filters['to'])))
            ->with(['session', 'trip'])
            ->latest('allocated_at')
            ->paginate(max(1, min($perPage, 100)))
            ->through(fn (ResourceAllocation $a) => [
                'id' => $a->uuid,
                'status' => $a->status->value,
                'status_label' => $a->status->label(),
                'status_tone' => $a->status->tone(),
                'mode' => $a->allocation_mode,
                'trip_id' => $a->trip_id,
                'vehicle_id' => $a->vehicle_id,
                'driver_id' => $a->driver_id,
                // Fleet's verdict at allocation time, quoted — never recomputed.
                'fleet_verdict' => $a->fleet_verdict,
                'driver_ready' => $a->driver_ready,
                'allocated_at' => $a->allocated_at?->toIso8601String(),
                'confirmed_at' => $a->confirmed_at?->toIso8601String(),
                'released_at' => $a->released_at?->toIso8601String(),
                'release_reason' => $a->release_reason,
                'session_id' => $a->session?->uuid,
            ]);
    }

    /**
     * Session history — every dispatcher window, including the closed ones the
     * live session list hides.
     *
     * @param  array<string, mixed>  $filters  company_id, status, from, to
     */
    public function sessions(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        return DispatchSession::query()
            ->when(($filters['company_id'] ?? null) !== null, fn ($q) => $q->where('company_id', $filters['company_id']))
            ->when(($filters['status'] ?? null) !== null, fn ($q) => $q->where('status', $filters['status']))
            ->when(($filters['from'] ?? null) !== null, fn ($q) => $q->where('started_at', '>=', Carbon::parse($filters['from'])))
            ->when(($filters['to'] ?? null) !== null, fn ($q) => $q->where('started_at', '<=', Carbon::parse($filters['to'])))
            ->latest('started_at')
            ->paginate(max(1, min($perPage, 100)))
            ->through(fn (DispatchSession $s) => [
                'id' => $s->uuid,
                'status' => $s->status->value,
                'status_label' => $s->status->label(),
                'status_tone' => $s->status->tone(),
                'mode' => $s->mode,
                'operator_name' => $s->operator_name,
                'started_at' => $s->started_at?->toIso8601String(),
                'ended_at' => $s->ended_at?->toIso8601String(),
                'duration_minutes' => $s->durationMinutes(),
                'assigned_count' => $s->assigned_count,
                'released_count' => $s->released_count,
                'conflict_count' => $s->conflict_count,
            ]);
    }

    /**
     * Capacity history — every reservation, including released and refused,
     * which are the interesting ones.
     *
     * @param  array<string, mixed>  $filters  company_id, status, from, to
     */
    public function capacity(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        return CapacityReservation::query()
            ->when(($filters['company_id'] ?? null) !== null, fn ($q) => $q->where('company_id', $filters['company_id']))
            ->when(($filters['status'] ?? null) !== null, fn ($q) => $q->where('status', $filters['status']))
            ->when(($filters['from'] ?? null) !== null, fn ($q) => $q->where('requested_at', '>=', Carbon::parse($filters['from'])))
            ->when(($filters['to'] ?? null) !== null, fn ($q) => $q->where('requested_at', '<=', Carbon::parse($filters['to'])))
            ->with(['slot', 'pool'])
            ->latest('requested_at')
            ->paginate(max(1, min($perPage, 100)))
            ->through(fn (CapacityReservation $r) => [
                'id' => $r->uuid,
                'status' => $r->status->value,
                'status_label' => $r->status->label(),
                'status_tone' => $r->status->tone(),
                'requested_orders' => (int) $r->requested_orders,
                'purpose' => $r->purpose,
                'pool' => $r->pool?->name,
                // Network's own words when it refused. Never paraphrased.
                'failure_reason' => $r->failure_reason,
                'release_reason' => $r->release_reason,
                'requested_at' => $r->requested_at?->toIso8601String(),
                'confirmed_at' => $r->confirmed_at?->toIso8601String(),
                'released_at' => $r->released_at?->toIso8601String(),
                'was_rebalanced' => $r->rebalanced_from_slot_id !== null,
            ]);
    }
}
