<?php

declare(strict_types=1);

namespace Modules\CostManagement\Presentation\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\CostManagement\Domain\Enums\PricingReviewStatus;
use Modules\CostManagement\Domain\Models\MaterialCostHistory;
use Modules\CostManagement\Domain\Models\PricingReview;

class CostManagementDashboardController extends Controller
{
    /**
     * GET /cost-management/dashboard
     * KPI cards for the Cost Management Dashboard.
     */
    public function index(): JsonResponse
    {
        $today = Carbon::today();

        // Pending reviews
        $pendingReviews = PricingReview::query()
            ->where('status', PricingReviewStatus::Pending->value)
            ->count();

        // Products whose current_margin is below target_margin (pending reviews only)
        $belowTargetMargin = PricingReview::query()
            ->where('status', PricingReviewStatus::Pending->value)
            ->whereRaw('current_margin < target_margin')
            ->count();

        // Material cost changes today
        $costIncreasedToday = MaterialCostHistory::query()
            ->whereDate('occurred_at', $today)
            ->where('difference', '>', 0)
            ->count();

        $costDecreasedToday = MaterialCostHistory::query()
            ->whereDate('occurred_at', $today)
            ->where('difference', '<', 0)
            ->count();

        // Expected monthly profit impact (sum of cost_difference × volume proxy)
        // Using difference from pending reviews as directional indicator
        $profitImpact = PricingReview::query()
            ->where('status', PricingReviewStatus::Pending->value)
            ->sum('cost_difference');

        // Average margin across pending reviews
        $avgMargin = PricingReview::query()
            ->where('status', PricingReviewStatus::Pending->value)
            ->avg('current_margin');

        // Products awaiting approval = pending reviews with reviewer assigned
        $awaitingApproval = PricingReview::query()
            ->where('status', PricingReviewStatus::Pending->value)
            ->whereNotNull('reviewer_name')
            ->count();

        return response()->json([
            'data' => [
                'pending_reviews' => $pendingReviews,
                'below_target_margin' => $belowTargetMargin,
                'cost_increased_today' => $costIncreasedToday,
                'cost_decreased_today' => $costDecreasedToday,
                'expected_profit_impact' => round((float) ($profitImpact ?? 0), 2),
                'average_margin' => $avgMargin !== null ? round((float) $avgMargin, 2) : null,
                'awaiting_approval' => $awaitingApproval,
            ],
        ]);
    }
}
