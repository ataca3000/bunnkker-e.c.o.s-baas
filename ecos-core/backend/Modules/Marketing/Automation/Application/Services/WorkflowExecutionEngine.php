<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\Marketing\Automation\Domain\Enums\WorkflowExecutionStatus;
use Modules\Marketing\Automation\Domain\Models\AutomationWorkflow;
use Modules\Marketing\Automation\Domain\Models\WorkflowExecution;
use Modules\Marketing\Automation\Domain\Models\WorkflowExecutionStep;
use RuntimeException;
use Throwable;

class WorkflowExecutionEngine
{
    public function __construct(
        private readonly ConditionEvaluatorService $conditionEvaluator,
        private readonly ActionDispatcherService $actionDispatcher,
        private readonly AutomationGovernanceService $governanceService,
    ) {}

    /** Dispatch a new execution for an entity (triggered by an event or manually) */
    public function dispatch(
        AutomationWorkflow $workflow,
        string $entityType,
        string $entityId,
        string $triggerType,
        array $triggerPayload = [],
        ?string $triggeredBy = null,
    ): WorkflowExecution {
        if (! $workflow->status->isLive()) {
            throw new RuntimeException("Workflow '{$workflow->name}' is not active.");
        }

        $this->governanceService->assertCanExecute($workflow, $entityType, $entityId);

        $execution = WorkflowExecution::create([
            'workflow_id' => $workflow->id,
            'workflow_version_id' => $workflow->current_version_id,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'status' => WorkflowExecutionStatus::PENDING,
            'trigger_type' => $triggerType,
            'trigger_payload' => $triggerPayload,
            'triggered_by' => $triggeredBy,
        ]);

        $workflow->increment('execution_count');
        $workflow->update(['last_executed_at' => now()]);

        return $execution;
    }

    /** Process a pending execution (called by queue worker) */
    public function process(WorkflowExecution $execution): void
    {
        if (! $execution->status->isActive()) {
            return;
        }

        $workflow = $execution->workflow;
        $graph = $workflow->nodes_graph;
        $nodes = collect($graph['nodes'] ?? []);
        $edges = collect($graph['edges'] ?? []);

        $execution->update(['status' => WorkflowExecutionStatus::RUNNING, 'started_at' => now()]);

        try {
            $this->traverseGraph($execution, $nodes, $edges);

            $execution->update(['status' => WorkflowExecutionStatus::COMPLETED, 'completed_at' => now()]);
        } catch (Throwable $e) {
            $execution->update([
                'status' => WorkflowExecutionStatus::FAILED,
                'failed_at' => now(),
                'error_message' => $e->getMessage(),
            ]);
        }
    }

    private function traverseGraph(WorkflowExecution $execution, $nodes, $edges): void
    {
        // Find trigger node
        $current = $nodes->firstWhere('type', 'trigger');
        if (! $current) {
            throw new RuntimeException('No trigger node found in workflow graph.');
        }

        $visited = [];

        while ($current && ! in_array($current['id'], $visited, true)) {
            $visited[] = $current['id'];

            $stepStatus = $this->processNode($execution, $current);

            // Advance to next node based on edges
            $nextNodeId = $this->resolveNextNode($edges, $current['id'], $stepStatus);

            if (! $nextNodeId) {
                break;
            }

            $current = $nodes->firstWhere('id', $nextNodeId);
            $execution->increment('step_count');
        }
    }

    private function processNode(WorkflowExecution $execution, array $node): string
    {
        $start = microtime(true);
        $status = 'completed';
        $output = [];
        $error = null;

        try {
            $output = match ($node['type']) {
                'trigger' => [], // already handled by dispatch
                'condition' => $this->conditionEvaluator->evaluate($execution, $node),
                'action' => $this->actionDispatcher->dispatch($execution, $node),
                'wait', 'delay' => ['waited' => true],
                'branch' => $this->conditionEvaluator->evaluate($execution, $node),
                'loop' => ['iterated' => true],
                default => [],
            };
        } catch (Throwable $e) {
            $status = 'failed';
            $error = $e->getMessage();
        }

        WorkflowExecutionStep::create([
            'execution_id' => $execution->id,
            'node_id' => $node['id'],
            'node_type' => $node['type'],
            'action_type' => $node['action_type'] ?? null,
            'status' => $status,
            'input' => $node['config'] ?? [],
            'output' => $output,
            'error' => $error,
            'duration_ms' => (int) ((microtime(true) - $start) * 1000),
            'executed_at' => now(),
        ]);

        return $status;
    }

    private function resolveNextNode($edges, string $currentId, string $stepStatus): ?string
    {
        $nextEdge = $edges->where('from', $currentId)
            ->first(fn ($e) => $e['condition'] === 'default' || $e['condition'] === $stepStatus);

        return $nextEdge['to'] ?? null;
    }

    public function cancel(WorkflowExecution $execution): void
    {
        if ($execution->status->isTerminal()) {
            return;
        }
        $execution->update(['status' => WorkflowExecutionStatus::CANCELLED, 'completed_at' => now()]);
    }

    public function retry(WorkflowExecution $execution, string $triggeredBy): WorkflowExecution
    {
        if (! $execution->canRetry()) {
            throw new RuntimeException('Execution cannot be retried.');
        }

        $execution->update([
            'status' => WorkflowExecutionStatus::PENDING,
            'error_message' => null,
            'failed_at' => null,
            'triggered_by' => $triggeredBy,
        ]);

        return $execution->fresh();
    }

    public function getExecutionStats(AutomationWorkflow $workflow): array
    {
        return DB::table('automation_workflow_executions')
            ->where('workflow_id', $workflow->id)
            ->selectRaw("
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)    AS failed,
                SUM(CASE WHEN status IN ('pending','running','waiting') THEN 1 ELSE 0 END) AS active,
                ROUND(AVG(TIMESTAMPDIFF(SECOND, started_at, completed_at)), 2) AS avg_duration_seconds
            ")
            ->first();
    }
}
