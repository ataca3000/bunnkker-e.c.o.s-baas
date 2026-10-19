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

class CampaignAudienceController extends Controller
{
    public function __construct(
        private readonly CampaignDraftService $draftService,
        private readonly CampaignVersioningService $versioningService,
    ) {}

    /** GET /mkt/studio/drafts/{draft}/audience */
    public function show(CampaignDraft $draft): JsonResponse
    {
        return response()->json(['data' => $draft->audience]);
    }

    /** PUT /mkt/studio/drafts/{draft}/audience */
    public function update(Request $request, CampaignDraft $draft): JsonResponse
    {
        $validated = $request->validate([
            'countries' => ['nullable', 'array'],
            'governorates' => ['nullable', 'array'],
            'cities' => ['nullable', 'array'],
            'radius_km' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'age_min' => ['nullable', 'integer', 'min:13', 'max:65'],
            'age_max' => ['nullable', 'integer', 'min:13', 'max:65'],
            'genders' => ['nullable', 'array'],
            'languages' => ['nullable', 'array'],
            'interests' => ['nullable', 'array'],
            'behaviors' => ['nullable', 'array'],
            'lookalike_audiences' => ['nullable', 'array'],
            'custom_audiences' => ['nullable', 'array'],
            'saved_audiences' => ['nullable', 'array'],
            'exclusions' => ['nullable', 'array'],
        ]);

        $audience = $this->draftService->updateAudience($draft, $validated);

        $this->versioningService->snapshot($draft->fresh(), VersionChangeType::AUDIENCE_CHANGE, (string) $request->user()->id, 'Audience updated');

        return response()->json(['data' => $audience]);
    }
}
