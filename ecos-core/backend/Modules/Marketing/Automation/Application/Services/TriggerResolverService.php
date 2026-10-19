<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Modules\Marketing\Automation\Domain\Enums\WorkflowTriggerType;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use Modules\Marketing\Automation\Domain\Models\WorkflowEventSubscription;

class TriggerResolverService
{
    /**
     * Resolve which active workflows should fire for a given BAE business event.
     * Returns the workflows that subscribe to this event type.
     */
    public function resolveWorkflowsForEvent(string $eventType, string $entityType, string $entityId): Collection
    {
        $subscriptions = WorkflowEventSubscription::with('workflow')
            ->where('event_type', $eventType)
            ->where('is_active', true)
            ->whereHas('workflow', fn ($q) => $q->where('status', 'active'))
            ->get();

        return $subscriptions
            ->filter(fn ($sub) => ! $sub->entity_type || $sub->entity_type === $entityType)
            ->filter(fn ($sub) => $this->matchesFilterConditions($sub->filter_conditions ?? [], $entityId, $entityType))
            ->map(fn ($sub) => $sub->workflow)
            ->filter();
    }

    /** Resolve entities to execute for a scheduled/date trigger */
    public function resolveEntitiesForSchedule(AutomationWorkflow $workflow): array
    {
        $nodes = collect($workflow->nodes_graph['nodes'] ?? []);
        $triggerNode = $nodes->firstWhere('type', 'trigger');

        if (! $triggerNode) {
            return [];
        }

        $config = $triggerNode['config'] ?? [];
        $entityType = $config['entity_type'] ?? 'customer';

        // For date-based triggers (birthday/anniversary), find entities whose date matches today
        if ($workflow->trigger_type === WorkflowTriggerType::DATE_BASED) {
            return $this->resolveByDateField($entityType, $config['date_field'] ?? 'birthday');
        }

        // For scheduled triggers without a segment, target all active entities
        if ($segmentId = $config['segment_id'] ?? null) {
            return DB::table('automation_segment_memberships')
                ->where('segment_id', $segmentId)
                ->where('is_active', true)
                ->pluck('entity_id')
                ->toArray();
        }

        return [];
    }

    private function matchesFilterConditions(array $conditions, string $entityId, string $entityType): bool
    {
        if (empty($conditions)) {
            return true;
        }

        // Simplified: each condition is {field, operator, value} — match against entity
        foreach ($conditions as $condition) {
            $field = $condition['field'] ?? null;
            $operator = $condition['operator'] ?? 'equals';
            $value = $condition['value'] ?? null;

            if (! $field) {
                continue;
            }

            $entityValue = DB::table($entityType.'s')->where('id', $entityId)->value($field);

            $passes = match ($operator) {
                'equals' => $entityValue === $value,
                'not_equals' => $entityValue !== $value,
                'not_null' => $entityValue !== null,
                default => true,
            };

            if (! $passes) {
                return false;
            }
        }

        return true;
    }

    private function resolveByDateField(string $entityType, string $dateField): array
    {
        $today = now()->format('m-d');

        return DB::table($entityType.'s')
            ->whereRaw("TO_CHAR({$dateField}, 'MM-DD') = ?", [$today])
            ->pluck('id')
            ->toArray();
    }
}
