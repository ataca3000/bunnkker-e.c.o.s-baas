<?php

declare(strict_types=1);

namespace Modules\Marketing\Initiatives\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Initiatives\Application\Services\InitiativeKpiService;
use Modules\Marketing\Initiatives\Domain\Models\MarketingInitiative;

/**
 * Initiative Dashboard — Executive View (Phase 4 + 9).
 *
 * CEOs work with Initiatives.
 * Marketing specialists work with Campaigns.
 */
final class InitiativeDashboardController extends Controller
{
    public function __construct(
        private readonly InitiativeKpiService $kpiService,
    ) {}

    /** GET /marketing/initiative-dashboard — aggregate across all initiatives */
    public function index(Request $request): JsonResponse
    {
        $datePreset = $request->query('date_preset', 'last_30d');
        $companyId = $request->query('company_id');

        $aggregate = $this->kpiService->aggregateAll($datePreset, $companyId);

        // Status distribution
        $statusDist = MarketingInitiative::query()
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        // Business goal distribution
        $goalDist = MarketingInitiative::query()
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->whereNotNull('business_goal')
            ->selectRaw('business_goal, COUNT(*) as count')
            ->groupBy('business_goal')
            ->pluck('count', 'business_goal');

        // Owner distribution (top 10)
        $ownerDist = MarketingInitiative::query()
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->whereNotNull('owner_id')
            ->selectRaw('owner_id, COUNT(*) as count')
            ->groupBy('owner_id')
            ->orderByDesc('count')
            ->limit(10)
            ->pluck('count', 'owner_id');

        // Timeline: upcoming initiatives (end_date in next 30 days)
        $upcoming = MarketingInitiative::query()
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->whereIn('status', ['draft', 'active', 'paused'])
            ->whereNotNull('end_date')
            ->where('end_date', '>=', now()->toDateString())
            ->where('end_date', '<=', now()->addDays(30)->toDateString())
            ->withCount('campaigns')
            ->orderBy('end_date')
            ->limit(5)
            ->get()
            ->map(fn ($i) => [
                'id' => $i->id,
                'name' => $i->name,
                'status' => $i->status->value,
                'end_date' => $i->end_date->toDateString(),
                'days_remaining' => $i->daysRemaining(),
                'campaigns_count' => $i->campaigns_count,
            ]);

        return response()->json([
            'aggregate' => $aggregate,
            'status_distribution' => $statusDist,
            'goal_distribution' => $goalDist,
            'owner_distribution' => $ownerDist,
            'upcoming_deadlines' => $upcoming,
        ]);
    }

    /** GET /marketing/initiatives/{initiative}/kpis */
    public function kpis(Request $request, MarketingInitiative $initiative): JsonResponse
    {
        $datePreset = $request->query('date_preset', 'last_30d');

        $kpis = $this->kpiService->forInitiative($initiative, $datePreset);

        return response()->json($kpis);
    }
}
