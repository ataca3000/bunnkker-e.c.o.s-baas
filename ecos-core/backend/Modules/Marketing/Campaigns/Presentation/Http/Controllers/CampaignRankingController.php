<?php

declare(strict_types=1);

namespace Modules\Marketing\Campaigns\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Campaigns\Application\Services\CampaignRankingService;

final class CampaignRankingController extends Controller
{
    public function __construct(
        private readonly CampaignRankingService $rankingService,
    ) {}

    /** GET /marketing/campaigns/ranking/campaigns */
    public function topCampaigns(Request $request): JsonResponse
    {
        return $this->rankResponse('campaign', $request);
    }

    /** GET /marketing/campaigns/ranking/ad-sets */
    public function topAdSets(Request $request): JsonResponse
    {
        return $this->rankResponse('adset', $request);
    }

    /** GET /marketing/campaigns/ranking/ads */
    public function topAds(Request $request): JsonResponse
    {
        return $this->rankResponse('ad', $request);
    }

    /** GET /marketing/campaigns/ranking/companies */
    public function topCompanies(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->rankingService->topByDimension(
                dimension: 'company_id',
                metric: $request->query('metric', 'spend'),
                limit: (int) $request->query('limit', 10),
            ),
        ]);
    }

    /** GET /marketing/campaigns/ranking/brands */
    public function topBrands(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->rankingService->topByDimension(
                dimension: 'brand_id',
                metric: $request->query('metric', 'spend'),
                limit: (int) $request->query('limit', 10),
            ),
        ]);
    }

    /** GET /marketing/campaigns/ranking/channels */
    public function topChannels(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->rankingService->topByDimension(
                dimension: 'channel_id',
                metric: $request->query('metric', 'spend'),
                limit: (int) $request->query('limit', 10),
            ),
        ]);
    }

    /** GET /marketing/campaigns/ranking/owners */
    public function topOwners(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->rankingService->topByDimension(
                dimension: 'marketing_owner_id',
                metric: $request->query('metric', 'spend'),
                limit: (int) $request->query('limit', 10),
            ),
        ]);
    }

    private function rankResponse(string $level, Request $request): JsonResponse
    {
        $data = $this->rankingService->top(
            metric: $request->query('metric', 'spend'),
            level: $level,
            limit: min((int) $request->query('limit', 10), 50),
            companyId: $request->query('company_id'),
            datePreset: $request->query('date_preset', 'last_30d'),
        );

        return response()->json(['data' => $data]);
    }
}
