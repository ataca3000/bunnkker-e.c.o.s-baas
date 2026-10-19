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

class CampaignCreativeController extends Controller
{
    public function __construct(
        private readonly CampaignDraftService $draftService,
        private readonly CampaignVersioningService $versioningService,
    ) {}

    /** GET /mkt/studio/drafts/{draft}/creatives */
    public function index(CampaignDraft $draft): JsonResponse
    {
        return response()->json(['data' => $draft->creatives]);
    }

    /** POST /mkt/studio/drafts/{draft}/creatives */
    public function store(Request $request, CampaignDraft $draft): JsonResponse
    {
        $validated = $request->validate([
            'creative_type' => ['required', 'in:image,video,carousel,collection,story,reel,other'],
            'name' => ['nullable', 'string', 'max:500'],
            'headline' => ['nullable', 'string', 'max:500'],
            'primary_text' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'call_to_action' => ['nullable', 'string', 'max:100'],
            'destination_url' => ['nullable', 'url'],
            'utm_params' => ['nullable', 'array'],
            'media_items' => ['nullable', 'array'],
            'asset_ids' => ['nullable', 'array'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $creative = $this->draftService->upsertCreative($draft, $validated);

        $this->versioningService->snapshot($draft->fresh(), VersionChangeType::CREATIVE_CHANGE, (string) $request->user()->id, 'Creative added');

        return response()->json(['data' => $creative], 201);
    }

    /** PATCH /mkt/studio/drafts/{draft}/creatives/{creative} */
    public function update(Request $request, CampaignDraft $draft, string $creative): JsonResponse
    {
        $validated = $request->validate([
            'creative_type' => ['sometimes', 'in:image,video,carousel,collection,story,reel,other'],
            'name' => ['sometimes', 'nullable', 'string', 'max:500'],
            'headline' => ['sometimes', 'nullable', 'string', 'max:500'],
            'primary_text' => ['sometimes', 'nullable', 'string'],
            'description' => ['sometimes', 'nullable', 'string'],
            'call_to_action' => ['sometimes', 'nullable', 'string', 'max:100'],
            'destination_url' => ['sometimes', 'nullable', 'url'],
            'utm_params' => ['sometimes', 'nullable', 'array'],
            'media_items' => ['sometimes', 'nullable', 'array'],
            'asset_ids' => ['sometimes', 'nullable', 'array'],
            'sort_order' => ['sometimes', 'nullable', 'integer', 'min:0'],
        ]);

        $updated = $this->draftService->upsertCreative($draft, $validated, $creative);

        return response()->json(['data' => $updated]);
    }

    /** DELETE /mkt/studio/drafts/{draft}/creatives/{creative} */
    public function destroy(Request $request, CampaignDraft $draft, string $creative): JsonResponse
    {
        $this->draftService->deleteCreative($draft, $creative);
        $this->versioningService->snapshot($draft->fresh(), VersionChangeType::CREATIVE_CHANGE, (string) $request->user()->id, 'Creative removed');

        return response()->json(null, 204);
    }
}
