<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Core\BusinessAttribution\Application\Actions\AttachBusinessDnaAction;
use Modules\Core\BusinessAttribution\Application\Services\BusinessDnaService;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessDna;
use Modules\Core\BusinessAttribution\Presentation\Http\Resources\BusinessDnaResource;

class BusinessDnaController extends Controller
{
    public function __construct(
        private readonly BusinessDnaService $dnaService,
        private readonly AttachBusinessDnaAction $attachAction,
    ) {}

    /** Search all DNA records. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = BusinessDna::query()->with(['journeySteps', 'metrics']);

        if ($request->filled('entity_type')) {
            $query->where('entity_type', $request->query('entity_type'));
        }
        if ($request->filled('company_id')) {
            $query->where('company_id', $request->query('company_id'));
        }
        if ($request->filled('campaign_id')) {
            $query->where('campaign_id', $request->query('campaign_id'));
        }
        if ($request->filled('initiative_id')) {
            $query->where('initiative_id', $request->query('initiative_id'));
        }
        if ($request->filled('customer_lifetime_stage')) {
            $query->where('customer_lifetime_stage', $request->query('customer_lifetime_stage'));
        }

        $perPage = min((int) $request->query('per_page', 25), 100);

        return BusinessDnaResource::collection($query->orderByDesc('created_at')->paginate($perPage));
    }

    /** Look up DNA by entity reference. */
    public function forEntity(Request $request): JsonResponse
    {
        $request->validate([
            'entity_type' => ['required', 'string'],
            'entity_id' => ['required', 'uuid'],
        ]);

        $dna = $this->dnaService->getForEntity(
            $request->query('entity_type'),
            $request->query('entity_id'),
        );

        if ($dna === null) {
            return response()->json(['message' => 'No DNA found for this entity.'], 404);
        }

        return response()->json(['data' => new BusinessDnaResource($dna)]);
    }

    /** Show a single DNA record with full journey + metrics. */
    public function show(BusinessDna $businessDna): BusinessDnaResource
    {
        $businessDna->load(['journeySteps', 'metrics']);

        return new BusinessDnaResource($businessDna);
    }

    /**
     * Create or enrich a Business DNA record.
     * Used by modules to register attribution data for their entities.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'entity_type' => ['required', 'string'],
            'entity_id' => ['required', 'uuid'],
            'origin_provider' => ['nullable', 'string', 'max:50'],
            'origin_platform' => ['nullable', 'string', 'max:100'],
            'initiative_id' => ['nullable', 'uuid'],
            'campaign_id' => ['nullable', 'uuid'],
            'ad_set_id' => ['nullable', 'uuid'],
            'ad_id' => ['nullable', 'uuid'],
            'creative_id' => ['nullable', 'uuid'],
            'landing_page' => ['nullable', 'string', 'max:500'],
            'conversation_source' => ['nullable', 'string', 'max:100'],
            'lead_source' => ['nullable', 'string', 'max:100'],
            'sales_rep_id' => ['nullable', 'uuid'],
            'company_id' => ['nullable', 'uuid'],
            'brand_id' => ['nullable', 'uuid'],
            'channel_id' => ['nullable', 'uuid'],
            'cost_center' => ['nullable', 'string', 'max:100'],
            'business_unit' => ['nullable', 'string', 'max:100'],
            'attribution_model' => ['nullable', 'string'],
            'provider_metadata' => ['nullable', 'array'],
            'erp_metadata' => ['nullable', 'array'],
        ]);

        $dna = $this->attachAction->execute(
            $data['entity_type'],
            $data['entity_id'],
            $data,
        );

        return response()->json(['data' => new BusinessDnaResource($dna)], 201);
    }

    /** Update attribution fields. */
    public function update(Request $request, BusinessDna $businessDna): BusinessDnaResource
    {
        $data = $request->validate([
            'initiative_id' => ['nullable', 'uuid'],
            'campaign_id' => ['nullable', 'uuid'],
            'lead_source' => ['nullable', 'string', 'max:100'],
            'sales_rep_id' => ['nullable', 'uuid'],
            'customer_lifetime_stage' => ['nullable', 'string', 'max:50'],
            'attribution_model' => ['nullable', 'string'],
            'erp_metadata' => ['nullable', 'array'],
            'first_touch' => ['nullable', 'array'],
            'last_touch' => ['nullable', 'array'],
        ]);

        $this->dnaService->update($businessDna->id, $data);
        $businessDna->refresh()->load(['journeySteps', 'metrics']);

        return new BusinessDnaResource($businessDna);
    }
}
