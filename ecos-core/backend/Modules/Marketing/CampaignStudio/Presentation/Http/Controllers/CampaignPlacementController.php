<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignDraftService;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignVersioningService;
use Modules\Marketing\CampaignStudio\Domain\Enums\VersionChangeType;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;

class CampaignPlacementController extends Controller
{
    public function __construct(
        private readonly CampaignDraftService $draftService,
        private readonly CampaignVersioningService $versioningService,
    ) {}

    /** GET /mkt/studio/drafts/{draft}/placements */
    public function show(CampaignDraft $draft): JsonResponse
    {
        return response()->json(['data' => $draft->placement]);
    }

    /** PUT /mkt/studio/drafts/{draft}/placements */
    public function update(Request $request, CampaignDraft $draft): JsonResponse
    {
        $validated = $request->validate([
            'placement_mode' => ['required', 'in:auto,manual'],
            'facebook_feed' => ['sometimes', 'boolean'],
            'instagram_feed' => ['sometimes', 'boolean'],
            'facebook_stories' => ['sometimes', 'boolean'],
            'instagram_stories' => ['sometimes', 'boolean'],
            'facebook_reels' => ['sometimes', 'boolean'],
            'instagram_reels' => ['sometimes', 'boolean'],
            'messenger_inbox' => ['sometimes', 'boolean'],
            'audience_network' => ['sometimes', 'boolean'],
            'excluded_placements' => ['nullable', 'array'],
        ]);

        $placement = $this->draftService->updatePlacements($draft, $validated);

        $this->versioningService->snapshot($draft->fresh(), VersionChangeType::PLACEMENT_CHANGE, (string) $request->user()->id, 'Placements updated');

        return response()->json(['data' => $placement]);
    }
}
