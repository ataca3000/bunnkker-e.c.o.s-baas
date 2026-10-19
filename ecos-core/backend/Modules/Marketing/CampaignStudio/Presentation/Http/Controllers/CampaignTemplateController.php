<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\CampaignStudio\Application\Actions\CreateCampaignFromTemplateAction;
use Modules\Marketing\CampaignStudio\Application\Services\CampaignTemplateService;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignTemplate;
use Modules\Marketing\CampaignStudio\Presentation\Http\Resources\CampaignDraftResource;
use Modules\Marketing\CampaignStudio\Presentation\Http\Resources\CampaignTemplateResource;

class CampaignTemplateController extends Controller
{
    public function __construct(
        private readonly CampaignTemplateService $templateService,
        private readonly CreateCampaignFromTemplateAction $createFromTemplateAction,
    ) {}

    /** GET /mkt/studio/templates */
    public function index(Request $request): JsonResponse
    {
        $templates = $this->templateService->list(
            $request->only(['company_id', 'category', 'search']),
            (int) $request->query('per_page', 25),
        );

        return response()->json([
            'data' => CampaignTemplateResource::collection($templates->items())->resolve(),
            'meta' => [
                'current_page' => $templates->currentPage(),
                'last_page' => $templates->lastPage(),
                'per_page' => $templates->perPage(),
                'total' => $templates->total(),
            ],
        ]);
    }

    /** POST /mkt/studio/templates */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category' => ['required', 'string', 'max:50'],
            'company_id' => ['nullable', 'string'],
            'default_objective' => ['nullable', 'string'],
            'default_buying_type' => ['nullable', 'string'],
            'default_budget_type' => ['nullable', 'in:daily,lifetime'],
            'default_daily_budget' => ['nullable', 'numeric', 'min:0'],
            'default_bid_strategy' => ['nullable', 'string'],
            'default_optimization_goal' => ['nullable', 'string'],
            'default_audience' => ['nullable', 'array'],
            'default_placements' => ['nullable', 'array'],
            'default_business_goal' => ['nullable', 'string'],
            'default_season' => ['nullable', 'string'],
            'required_assets' => ['nullable', 'array'],
            'approval_workflow_id' => ['nullable', 'uuid'],
            'is_global' => ['sometimes', 'boolean'],
        ]);

        $template = $this->templateService->create($validated, (string) $request->user()->id);

        return response()->json(['data' => new CampaignTemplateResource($template)], 201);
    }

    /** GET /mkt/studio/templates/{template} */
    public function show(CampaignTemplate $template): JsonResponse
    {
        return response()->json(['data' => new CampaignTemplateResource($template)]);
    }

    /** PUT /mkt/studio/templates/{template} */
    public function update(Request $request, CampaignTemplate $template): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'category' => ['sometimes', 'string', 'max:50'],
            'is_global' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $updated = $this->templateService->update($template, $validated, (string) $request->user()->id);

        return response()->json(['data' => new CampaignTemplateResource($updated)]);
    }

    /** DELETE /mkt/studio/templates/{template} */
    public function destroy(CampaignTemplate $template): JsonResponse
    {
        $this->templateService->delete($template);

        return response()->json(null, 204);
    }

    /** POST /mkt/studio/templates/{template}/create-campaign */
    public function createCampaign(Request $request, CampaignTemplate $template): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:500'],
            'company_id' => ['nullable', 'string'],
            'brand_id' => ['nullable', 'string'],
        ]);

        $draft = $this->createFromTemplateAction->execute($template, $validated, (string) $request->user()->id);

        return response()->json(['data' => new CampaignDraftResource($draft)], 201);
    }
}
