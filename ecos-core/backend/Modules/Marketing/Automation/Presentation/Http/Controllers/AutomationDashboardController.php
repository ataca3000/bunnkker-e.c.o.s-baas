<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Marketing\Automation\Application\Services\WorkflowService;

class AutomationDashboardController extends Controller
{
    public function __construct(private readonly WorkflowService $workflowService) {}

    public function index(Request $request): JsonResponse
    {
        $companyId = $request->get('company_id');

        $kpis = $this->workflowService->getKpis(['company_id' => $companyId]);
        $trending = $this->getTrendingWorkflows($companyId);
        $recent = $this->getRecentExecutions($companyId);
        $health = $this->getHealthMetrics($companyId);

        return response()->json([
            'kpis' => $kpis,
            'trending_workflows' => $trending,
            'recent_executions' => $recent,
            'health' => $health,
        ]);
    }

    private function getTrendingWorkflows(?string $companyId): array
    {
        return DB::table('automation_workflows')
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->where('status', 'active')
            ->orderByDesc('execution_count')
            ->limit(5)
            ->get(['id', 'name', 'execution_count', 'last_executed_at'])
            ->toArray();
    }

    private function getRecentExecutions(?string $companyId): array
    {
        return DB::table('automation_workflow_executions as e')
            ->join('automation_workflows as w', 'e.workflow_id', '=', 'w.id')
            ->when($companyId, fn ($q) => $q->where('w.company_id', $companyId))
            ->orderByDesc('e.created_at')
            ->limit(10)
            ->get(['e.id', 'w.name as workflow_name', 'e.entity_type', 'e.entity_id', 'e.status', 'e.created_at'])
            ->toArray();
    }

    private function getHealthMetrics(?string $companyId): array
    {
        $stats = DB::table('automation_workflow_executions as e')
            ->join('automation_workflows as w', 'e.workflow_id', '=', 'w.id')
            ->when($companyId, fn ($q) => $q->where('w.company_id', $companyId))
            ->whereDate('e.created_at', '>=', now()->subDays(7))
            ->selectRaw("
                COUNT(*) AS total_7d,
                SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END) AS completed_7d,
                SUM(CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END) AS failed_7d,
                ROUND(
                    100.0 * SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
                    1
                ) AS success_rate
            ")
            ->first();

        return (array) $stats;
    }
}
