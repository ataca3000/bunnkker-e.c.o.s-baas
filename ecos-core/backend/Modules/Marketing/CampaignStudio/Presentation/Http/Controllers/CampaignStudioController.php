<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\CampaignStudio\Application\Actions\CreateCampaignDraftAction;
use Modules\Marketing\CampaignStudio\Application\Actions\DuplicateCampaignDraftAction;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignDraftService;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignVersioningService;
use Modules\Marketing\CampaignStudio\Domain\Enums\VersionChangeType;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Presentation\Http\Resources\CampaignDraftResource;

class CampaignStudioController extends Controller
{
    public function __construct(
        private readonly CampaignDraftService $draftService,
        private readonly CreateCampaignDraftAction $createAction,
        private readonly DuplicateCampaignDraftAction $duplicateAction,
        private readonly CampaignVersioningService $versioningService,
    ) {}

    /** GET /mkt/studio/drafts */
    public function index(Request $request): JsonResponse
    {
        $drafts = $this->draftService->list(
            $request->only(['status', 'company_id', 'brand_id', 'initiative_id', 'campaign_owner_id', 'search', 'connector_type']),
            (int) $request->query('per_page', 25),
        );

        return response()->json([
            'data' => CampaignDraftResource::collection($drafts->items())->resolve(),
            'meta' => [
                'current_page' => $drafts->currentPage(),
                'last_page' => $drafts->lastPage(),
                'per_page' => $drafts->perPage(),
                'total' => $drafts->total(),
            ],
        ]);
    }

    /** GET /mkt/studio/kpis */
    public function kpis(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->draftService->getStudioKpis($request->only(['company_id'])),
        ]);
    }

    /** POST /mkt/studio/drafts */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:500'],
            'initiative_id' => ['nullable', 'uuid'],
            'company_id' => ['nullable', 'string', 'max:36'],
            'brand_id' => ['nullable', 'string', 'max:36'],
            'channel_id' => ['nullable', 'string', 'max:36'],
            'objective' => ['nullable', 'string', 'max:100'],
            'connector_type' => ['nullable', 'string', 'max:30'],
            'connection_id' => ['nullable', 'uuid'],
            'template_id' => ['nullable', 'uuid'],
            'business_goal' => ['nullable', 'string', 'max:50'],
            'season' => ['nullable', 'string', 'max:50'],
            'campaign_owner_id' => ['nullable', 'string', 'max:36'],
            'budget_owner' => ['nullable', 'string', 'max:255'],
            'marketing_team' => ['nullable', 'string', 'max:255'],
        ]);

        $draft = $this->createAction->execute($validated, (string) $request->user()->id);

        return response()->json(['data' => new CampaignDraftResource($draft)], 201);
    }

    /** GET /mkt/studio/drafts/{draft} */
    public function show(CampaignDraft $draft): JsonResponse
    {
        $draft->load(['audience', 'creatives', 'placement', 'versions', 'currentApproval.decisions', 'publishingJobs', 'products', 'validationResults', 'scheduleTasks']);

        return response()->json(['data' => new CampaignDraftResource($draft)]);
    }

    /** PATCH /mkt/studio/drafts/{draft} */
    public function update(Request $request, CampaignDraft $draft): JsonResponse
    {
        if (! $draft->isEditable()) {
            return response()->json(['message' => 'Campaign is not in an editable state.'], 422);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:500'],
            'objective' => ['sometimes', 'nullable', 'string', 'max:100'],
            'buying_type' => ['sometimes', 'nullable', 'string', 'max:50'],
            'budget_type' => ['sometimes', 'nullable', 'in:daily,lifetime'],
            'daily_budget' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'lifetime_budget' => ['sometimes', 'nullable', 'numeric', 'min:0'],
            'bid_strategy' => ['sometimes', 'nullable', 'string', 'max:100'],
            'optimization_goal' => ['sometimes', 'nullable', 'string', 'max:100'],
            'timezone' => ['sometimes', 'nullable', 'string', 'max:100'],
            'start_date' => ['sometimes', 'nullable', 'date'],
            'end_date' => ['sometimes', 'nullable', 'date'],
            'initiative_id' => ['sometimes', 'nullable', 'uuid'],
            'company_id' => ['sometimes', 'nullable', 'string'],
            'brand_id' => ['sometimes', 'nullable', 'string'],
            'channel_id' => ['sometimes', 'nullable', 'string'],
            'campaign_owner_id' => ['sometimes', 'nullable', 'string'],
            'budget_owner' => ['sometimes', 'nullable', 'string', 'max:255'],
            'marketing_team' => ['sometimes', 'nullable', 'string', 'max:255'],
            'season' => ['sometimes', 'nullable', 'string', 'max:50'],
            'business_goal' => ['sometimes', 'nullable', 'string', 'max:50'],
            'tags' => ['sometimes', 'nullable', 'array'],
            'internal_notes' => ['sometimes', 'nullable', 'string'],
            'ad_account_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'business_manager_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'page_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'instagram_account_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'pixel_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'catalog_id' => ['sometimes', 'nullable', 'string', 'max:255'],
            'domain' => ['sometimes', 'nullable', 'string', 'max:500'],
            'connection_id' => ['sometimes', 'nullable', 'uuid'],
            'connector_type' => ['sometimes', 'nullable', 'string', 'max:30'],
        ]);

        $updated = $this->draftService->update($draft, $validated, (string) $request->user()->id);

        // Track version for significant field changes
        $trackFields = array_intersect_key($validated, array_flip(['daily_budget', 'lifetime_budget', 'budget_type', 'start_date', 'end_date', 'objective']));
        if (! empty($trackFields)) {
            $this->versioningService->snapshot($updated, VersionChangeType::SETTINGS_CHANGE, (string) $request->user()->id, 'Campaign settings updated', array_keys($trackFields));
        }

        return response()->json(['data' => new CampaignDraftResource($updated->fresh())]);
    }

    /** DELETE /mkt/studio/drafts/{draft} */
    public function destroy(CampaignDraft $draft): JsonResponse
    {
        $this->draftService->delete($draft);

        return response()->json(null, 204);
    }

    /** POST /mkt/studio/drafts/{draft}/duplicate */
    public function duplicate(Request $request, CampaignDraft $draft): JsonResponse
    {
        $copy = $this->duplicateAction->execute($draft, (string) $request->user()->id);

        return response()->json(['data' => new CampaignDraftResource($copy)], 201);
    }
}
