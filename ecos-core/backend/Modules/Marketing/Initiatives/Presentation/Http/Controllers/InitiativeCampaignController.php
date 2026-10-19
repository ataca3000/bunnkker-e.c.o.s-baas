<?php

declare(strict_types=1);

namespace Modules\Marketing\Initiatives\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Marketing\Campaigns\Domain\Models\Campaign;
use Modules\Marketing\Campaigns\Presentation\Http\Resources\CampaignResource;
use Modules\Marketing\Initiatives\Application\Actions\AssignCampaignsToInitiativeAction;
use Modules\Marketing\Initiatives\Application\Actions\RemoveCampaignFromInitiativeAction;
use Modules\Marketing\Initiatives\Domain\Models\MarketingInitiative;

final class InitiativeCampaignController extends Controller
{
    public function __construct(
        private readonly AssignCampaignsToInitiativeAction $assignAction,
        private readonly RemoveCampaignFromInitiativeAction $removeAction,
    ) {}

    /** GET /marketing/initiatives/{initiative}/campaigns */
    public function index(Request $request, MarketingInitiative $initiative): AnonymousResourceCollection
    {
        $campaigns = Campaign::where('marketing_initiative_id', $initiative->id)
            ->withCount('adSets')
            ->orderBy('created_at', 'desc')
            ->paginate((int) $request->query('per_page', 25));

        return CampaignResource::collection($campaigns);
    }

    /** POST /marketing/initiatives/{initiative}/campaigns */
    public function assign(Request $request, MarketingInitiative $initiative): JsonResponse
    {
        $validated = $request->validate([
            'campaign_ids' => ['required', 'array', 'min:1'],
            'campaign_ids.*' => ['required', 'string'],
        ]);

        $result = $this->assignAction->execute(
            initiative: $initiative,
            campaignIds: $validated['campaign_ids'],
            actorId: $request->user()?->id,
        );

        return response()->json([
            'message' => "{$result['assigned']} campaign(s) assigned to initiative.",
            'result' => $result,
        ]);
    }

    /** DELETE /marketing/initiatives/{initiative}/campaigns/{campaign} */
    public function remove(Request $request, MarketingInitiative $initiative, Campaign $campaign): JsonResponse
    {
        $this->removeAction->execute(
            initiative: $initiative,
            campaign: $campaign,
            actorId: $request->user()?->id,
        );

        return response()->json(['message' => 'Campaign removed from initiative.']);
    }
}
