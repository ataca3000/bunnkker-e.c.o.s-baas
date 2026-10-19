<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Services;

use Illuminate\Database\Eloquent\Collection;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use Modules\Marketing\Automation\Domain\Models\WorkflowVersion;
use RuntimeException;

class WorkflowVersioningService
{
    public function snapshot(AutomationWorkflow $workflow, string $changedBy, string $changeNote = ''): WorkflowVersion
    {
        $version = WorkflowVersion::create([
            'workflow_id' => $workflow->id,
            'version_number' => $workflow->version_number,
            'nodes_graph' => $workflow->nodes_graph,
            'trigger_type' => $workflow->trigger_type->value,
            'changed_by' => $changedBy,
            'change_note' => $changeNote ?: null,
        ]);

        $workflow->increment('version_number');
        $workflow->update(['current_version_id' => $version->id, 'updated_by' => $changedBy]);

        return $version;
    }

    public function getHistory(AutomationWorkflow $workflow): Collection
    {
        return $workflow->versions()->orderByDesc('version_number')->get();
    }

    public function compare(WorkflowVersion $a, WorkflowVersion $b): array
    {
        $aNodes = collect($a->nodes_graph['nodes'] ?? []);
        $bNodes = collect($b->nodes_graph['nodes'] ?? []);

        $aIds = $aNodes->pluck('id')->toArray();
        $bIds = $bNodes->pluck('id')->toArray();

        return [
            'version_a' => $a->version_number,
            'version_b' => $b->version_number,
            'added_nodes' => array_values(array_diff($bIds, $aIds)),
            'removed_nodes' => array_values(array_diff($aIds, $bIds)),
            'common_nodes' => array_values(array_intersect($aIds, $bIds)),
            'a_edge_count' => count($a->nodes_graph['edges'] ?? []),
            'b_edge_count' => count($b->nodes_graph['edges'] ?? []),
        ];
    }

    public function restoreToVersion(AutomationWorkflow $workflow, WorkflowVersion $version, string $userId): AutomationWorkflow
    {
        if (! $workflow->isEditable()) {
            throw new RuntimeException('Workflow is not editable.');
        }

        $workflow->update([
            'nodes_graph' => $version->nodes_graph,
            'trigger_type' => $version->trigger_type,
            'updated_by' => $userId,
        ]);

        $this->snapshot($workflow, $userId, "Restored to version {$version->version_number}");

        return $workflow->fresh();
    }
}
