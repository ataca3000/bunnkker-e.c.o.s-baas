<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Modules\Marketing\Automation\Domain\Enums\WorkflowStatus;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use Modules\Marketing\Automation\Domain\Models\WorkflowEventSubscription;
use RuntimeException;

class WorkflowService
{
    public function list(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        return AutomationWorkflow::query()
            ->when($filters['company_id'] ?? null, fn ($q, $v) => $q->where('company_id', $v))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($filters['trigger_type'] ?? null, fn ($q, $v) => $q->where('trigger_type', $v))
            ->when($filters['search'] ?? null, fn ($q, $v) => $q->where('name', 'ilike', "%{$v}%"))
            ->orderByDesc('updated_at')
            ->paginate($perPage);
    }

    public function find(string $id): AutomationWorkflow
    {
        return AutomationWorkflow::with(['versions', 'executions', 'schedule', 'eventSubscriptions'])->findOrFail($id);
    }

    public function create(array $data, string $userId): AutomationWorkflow
    {
        return DB::transaction(function () use ($data, $userId): AutomationWorkflow {
            $workflow = AutomationWorkflow::create([
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'company_id' => $data['company_id'] ?? null,
                'brand_id' => $data['brand_id'] ?? null,
                'trigger_type' => $data['trigger_type'],
                'status' => WorkflowStatus::DRAFT,
                'nodes_graph' => $data['nodes_graph'] ?? ['nodes' => [], 'edges' => []],
                'tags' => $data['tags'] ?? null,
                'governance_policy_id' => $data['governance_policy_id'] ?? null,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            // If business_event trigger, create initial subscription placeholder
            if ($data['trigger_type'] === 'business_event' && ! empty($data['event_type'])) {
                WorkflowEventSubscription::create([
                    'workflow_id' => $workflow->id,
                    'event_type' => $data['event_type'],
                    'entity_type' => $data['entity_type'] ?? null,
                ]);
            }

            return $workflow;
        });
    }

    public function update(AutomationWorkflow $workflow, array $data, string $userId): AutomationWorkflow
    {
        if (! $workflow->isEditable()) {
            throw new RuntimeException("Workflow '{$workflow->name}' is not in an editable state.");
        }

        $workflow->update(array_merge($data, ['updated_by' => $userId]));

        return $workflow->fresh();
    }

    public function updateNodesGraph(AutomationWorkflow $workflow, array $nodesGraph, string $userId): AutomationWorkflow
    {
        if (! $workflow->isEditable()) {
            throw new RuntimeException('Workflow is not editable.');
        }

        $workflow->update(['nodes_graph' => $nodesGraph, 'updated_by' => $userId]);

        return $workflow->fresh();
    }

    public function delete(AutomationWorkflow $workflow): void
    {
        if ($workflow->status === WorkflowStatus::ACTIVE) {
            throw new RuntimeException('Cannot delete an active workflow. Pause it first.');
        }

        $workflow->delete();
    }

    public function duplicate(AutomationWorkflow $workflow, string $userId): AutomationWorkflow
    {
        $copy = $workflow->replicate();
        $copy->name = "[Copy] {$workflow->name}";
        $copy->status = WorkflowStatus::DRAFT;
        $copy->created_by = $userId;
        $copy->updated_by = $userId;
        $copy->execution_count = 0;
        $copy->last_executed_at = null;
        $copy->activated_at = null;
        $copy->paused_at = null;
        $copy->archived_at = null;
        $copy->save();

        return $copy;
    }

    public function getKpis(array $filters = []): array
    {
        $base = AutomationWorkflow::query()
            ->when($filters['company_id'] ?? null, fn ($q, $v) => $q->where('company_id', $v));

        $counts = (clone $base)->selectRaw('status, COUNT(*) as cnt')->groupBy('status')->pluck('cnt', 'status');

        return [
            'draft' => (int) ($counts['draft'] ?? 0),
            'active' => (int) ($counts['active'] ?? 0),
            'paused' => (int) ($counts['paused'] ?? 0),
            'archived' => (int) ($counts['archived'] ?? 0),
            'pending_approval' => (int) ($counts['pending_approval'] ?? 0),
            'failed' => (int) ($counts['failed'] ?? 0),
            'total_executions' => (clone $base)->sum('execution_count'),
        ];
    }
}
