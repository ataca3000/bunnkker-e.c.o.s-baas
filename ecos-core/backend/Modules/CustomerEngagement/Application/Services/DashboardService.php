<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Services;

use Illuminate\Support\Facades\DB;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\Lead;

class DashboardService
{
    public function __construct(
        private readonly UnifiedInboxService $inboxService,
        private readonly SlaService $slaService,
    ) {}

    public function getKpis(?string $companyId = null): array
    {
        $inboxStats = $this->inboxService->getStats($companyId);
        $slaStats = $this->slaService->getComplianceStats($companyId);
        $leads = Lead::when($companyId, fn ($q) => $q->where('company_id', $companyId));

        return [
            'conversations' => $inboxStats,
            'sla' => $slaStats,
            'leads' => [
                'total' => (clone $leads)->count(),
                'new' => (clone $leads)->where('status', 'new')->count(),
                'qualified' => (clone $leads)->where('status', 'qualified')->count(),
                'converted' => (clone $leads)->where('status', 'converted')->count(),
            ],
        ];
    }

    public function getAgentPerformance(?string $companyId = null): array
    {
        $q = Conversation::query()
            ->select(
                'assigned_employee_id',
                DB::raw('COUNT(*) as total'),
                DB::raw("SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) as resolved"),
                DB::raw('AVG(unread_count) as avg_unread'),
            )
            ->whereNotNull('assigned_employee_id')
            ->groupBy('assigned_employee_id')
            ->orderByDesc('total');

        if ($companyId) {
            $q->where('company_id', $companyId);
        }

        return $q->limit(20)->get()->toArray();
    }

    public function getProviderDistribution(?string $companyId = null): array
    {
        return $this->inboxService->getProviderDistribution($companyId);
    }

    public function getStatusDistribution(?string $companyId = null): array
    {
        $q = Conversation::query()
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status');

        if ($companyId) {
            $q->where('company_id', $companyId);
        }

        return $q->get()->toArray();
    }
}
