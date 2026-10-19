<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignVersioningService;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignVersion;
use Modules\Marketing\CampaignStudio\Presentation\Http\Resources\CampaignVersionResource;

class CampaignVersionController extends Controller
{
    public function __construct(private readonly CampaignVersioningService $versioningService) {}

    /** GET /mkt/studio/drafts/{draft}/versions */
    public function index(CampaignDraft $draft): JsonResponse
    {
        $versions = $this->versioningService->getHistory($draft);

        return response()->json(['data' => CampaignVersionResource::collection($versions)->resolve()]);
    }

    /** GET /mkt/studio/drafts/{draft}/versions/{versionA}/compare/{versionB} */
    public function compare(CampaignDraft $draft, string $versionA, string $versionB): JsonResponse
    {
        $a = CampaignVersion::where('campaign_draft_id', $draft->id)->findOrFail($versionA);
        $b = CampaignVersion::where('campaign_draft_id', $draft->id)->findOrFail($versionB);

        return response()->json(['data' => $this->versioningService->compare($a, $b)]);
    }

    /** POST /mkt/studio/drafts/{draft}/versions/{version}/restore */
    public function restore(Request $request, CampaignDraft $draft, string $version): JsonResponse
    {
        $v = CampaignVersion::where('campaign_draft_id', $draft->id)->findOrFail($version);
        $updated = $this->versioningService->restoreToVersion($draft, $v, (string) $request->user()->id);

        return response()->json(['data' => $updated, 'message' => "Restored to version {$v->version_number}"]);
    }
}
