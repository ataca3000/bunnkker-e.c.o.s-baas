<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Modules\Marketing\Automation\Domain\Models\AudienceSegment;
use Modules\Marketing\Automation\Domain\Models\SegmentMembership;

class AudienceSegmentService
{
    public function list(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        return AudienceSegment::query()
            ->when($filters['company_id'] ?? null, fn ($q, $v) => $q->where('company_id', $v))
            ->when($filters['segment_type'] ?? null, fn ($q, $v) => $q->where('segment_type', $v))
            ->when($filters['search'] ?? null, fn ($q, $v) => $q->where('name', 'ilike', "%{$v}%"))
            ->where('is_active', true)
            ->orderByDesc('updated_at')
            ->paginate($perPage);
    }

    public function create(array $data, string $userId): AudienceSegment
    {
        return AudienceSegment::create([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'company_id' => $data['company_id'] ?? null,
            'segment_type' => $data['segment_type'],
            'rules' => $data['rules'],
            'entity_type' => $data['entity_type'] ?? 'customer',
            'is_dynamic' => $data['is_dynamic'] ?? true,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);
    }

    public function update(AudienceSegment $segment, array $data, string $userId): AudienceSegment
    {
        $segment->update(array_merge($data, ['updated_by' => $userId]));

        return $segment->fresh();
    }

    public function delete(AudienceSegment $segment): void
    {
        $segment->update(['is_active' => false]);
    }

    /**
     * Recalculate dynamic segment membership.
     * Queries domain tables based on segment rules and updates memberships.
     */
    public function recalculate(AudienceSegment $segment): array
    {
        if (! $segment->is_dynamic) {
            return ['skipped' => true, 'reason' => 'Static segment'];
        }

        $matchedIds = $this->resolveMatchingEntities($segment);

        $added = 0;
        $removed = 0;

        DB::transaction(function () use ($segment, $matchedIds, &$added, &$removed): void {
            // Activate new members
            foreach ($matchedIds as $entityId) {
                $existing = SegmentMembership::where('segment_id', $segment->id)
                    ->where('entity_type', $segment->entity_type)
                    ->where('entity_id', $entityId)
                    ->first();

                if (! $existing) {
                    SegmentMembership::create([
                        'segment_id' => $segment->id,
                        'entity_type' => $segment->entity_type,
                        'entity_id' => $entityId,
                        'is_active' => true,
                    ]);
                    $added++;
                } elseif (! $existing->is_active) {
                    $existing->update(['is_active' => true, 'removed_at' => null]);
                    $added++;
                }
            }

            // Deactivate former members
            $former = SegmentMembership::where('segment_id', $segment->id)
                ->where('is_active', true)
                ->whereNotIn('entity_id', $matchedIds)
                ->get();

            foreach ($former as $m) {
                $m->update(['is_active' => false, 'removed_at' => now()]);
                $removed++;
            }

            $segment->update([
                'member_count' => count($matchedIds),
                'last_calculated_at' => now(),
            ]);
        });

        return ['added' => $added, 'removed' => $removed, 'total' => count($matchedIds)];
    }

    /** Check if a specific entity is in the segment (live check, not just membership table) */
    public function isMember(AudienceSegment $segment, string $entityId): bool
    {
        if ($segment->is_dynamic) {
            $ids = $this->resolveMatchingEntities($segment);

            return in_array($entityId, $ids, true);
        }

        return SegmentMembership::where('segment_id', $segment->id)
            ->where('entity_id', $entityId)
            ->where('is_active', true)
            ->exists();
    }

    private function resolveMatchingEntities(AudienceSegment $segment): array
    {
        $rules = $segment->rules;

        // Build query based on rules — simplified rule evaluator
        $query = DB::table('customers')->select('id');

        foreach ($rules['conditions'] ?? [] as $condition) {
            $field = $condition['field'] ?? null;
            $operator = $condition['operator'] ?? 'equals';
            $value = $condition['value'] ?? null;

            if (! $field) {
                continue;
            }

            match ($operator) {
                'equals' => $query->where($field, $value),
                'not_equals' => $query->where($field, '!=', $value),
                'greater_than' => $query->where($field, '>', $value),
                'less_than' => $query->where($field, '<', $value),
                'contains' => $query->where($field, 'ilike', "%{$value}%"),
                'not_null' => $query->whereNotNull($field),
                'is_null' => $query->whereNull($field),
                default => null,
            };
        }

        return $query->pluck('id')->toArray();
    }
}
