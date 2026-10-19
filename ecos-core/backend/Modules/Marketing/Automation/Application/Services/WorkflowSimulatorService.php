<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;

class WorkflowSimulatorService
{
    public function __construct(
        private readonly ConditionEvaluatorService $conditionEvaluator,
        private readonly AudienceSegmentService $segmentService,
    ) {}

    /**
     * Simulate workflow execution without persisting or sending any real actions.
     * Returns: matched_customers, expected_actions, warnings, estimated_volume, estimated_cost.
     */
    public function simulate(AutomationWorkflow $workflow, array $sampleContext = []): array
    {
        $graph = $workflow->nodes_graph;
        $nodes = collect($graph['nodes'] ?? []);
        $edges = collect($graph['edges'] ?? []);

        $warnings = [];
        $expectedActions = [];
        $estimatedVolume = 0;

        // Validate graph structure
        $triggerNode = $nodes->firstWhere('type', 'trigger');
        if (! $triggerNode) {
            $warnings[] = 'No trigger node defined.';
        }

        // Count action nodes
        $actionNodes = $nodes->where('type', 'action');
        foreach ($actionNodes as $node) {
            $actionType = $node['action_type'] ?? null;
            $config = $node['config'] ?? [];

            $expectedActions[] = [
                'action_type' => $actionType,
                'node_id' => $node['id'],
                'label' => $node['label'] ?? $actionType,
                'config_preview' => array_intersect_key($config, array_flip(['template_id', 'channel', 'message_preview'])),
            ];

            if ($actionType === 'send_whatsapp' && empty($config['connection_id'])) {
                $warnings[] = "Action '{$node['label']}': No WhatsApp connection configured.";
            }

            if (in_array($actionType, ['send_whatsapp', 'send_messenger', 'send_email']) && empty($config['template_id']) && empty($config['message'])) {
                $warnings[] = "Action '{$node['label']}': No message template or content set.";
            }
        }

        // Estimate audience volume
        $estimatedVolume = $this->estimateVolume($workflow, $triggerNode ?? null);

        // Check governance
        if (! $workflow->governance_policy_id) {
            $warnings[] = 'No governance policy assigned — execution rate limits will not be enforced.';
        }

        // Detect orphan nodes (no edges in or out)
        foreach ($nodes as $node) {
            $hasIncoming = $edges->where('to', $node['id'])->isNotEmpty();
            $hasOutgoing = $edges->where('from', $node['id'])->isNotEmpty();

            if ($node['type'] !== 'trigger' && ! $hasIncoming) {
                $warnings[] = "Node '{$node['label']}' is unreachable (no incoming edge).";
            }
            if ($node['type'] !== 'action' && ! $hasOutgoing) {
                $warnings[] = "Node '{$node['label']}' has no outgoing edge — execution may terminate early.";
            }
        }

        return [
            'workflow_id' => $workflow->id,
            'workflow_name' => $workflow->name,
            'total_nodes' => $nodes->count(),
            'action_nodes' => $actionNodes->count(),
            'expected_actions' => $expectedActions,
            'estimated_volume' => $estimatedVolume,
            'estimated_cost' => null, // Placeholder for future cost estimation
            'warnings' => $warnings,
            'can_activate' => empty(array_filter($warnings, fn ($w) => str_starts_with($w, 'No trigger'))),
        ];
    }

    private function estimateVolume(AutomationWorkflow $workflow, ?array $triggerNode): int
    {
        if (! $triggerNode) {
            return 0;
        }

        $config = $triggerNode['config'] ?? [];

        // For business_event triggers, check how many entities fired that event in the last 30 days
        if ($workflow->trigger_type->value === 'business_event') {
            $eventType = $config['event_type'] ?? null;
            if (! $eventType) {
                return 0;
            }

            return (int) DB::table('business_events')
                ->where('event_type', $eventType)
                ->where('occurred_at', '>=', now()->subDays(30))
                ->count();
        }

        // For manual/api triggers, return 0 (unknown in advance)
        return 0;
    }
}
