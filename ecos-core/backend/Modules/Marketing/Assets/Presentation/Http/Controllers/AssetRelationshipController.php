<?php

declare(strict_types=1);

namespace Modules\Marketing\Assets\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Assets\Application\Actions\MapAssetAction;
use Modules\Marketing\Assets\Application\Services\RelationshipGraphService;
use Modules\Marketing\Assets\Domain\Models\MarketingAsset;
use Modules\Marketing\Assets\Domain\Models\MarketingAssetRelationship;
use Modules\Marketing\MappingEngine\Application\Services\MappingSuggestionService;

final class AssetRelationshipController extends Controller
{
    public function __construct(
        private readonly MapAssetAction $mapAsset,
        private readonly MappingSuggestionService $suggestions,
        private readonly RelationshipGraphService $graphService,
    ) {}

    /**
     * GET /marketing/assets/{asset}/relationships
     */
    public function index(MarketingAsset $marketingAsset): JsonResponse
    {
        $relationships = $marketingAsset->relationships()->get();

        return response()->json(['data' => $relationships]);
    }

    /**
     * POST /marketing/assets/{asset}/relationships
     *
     * Body: { related_type, related_id, confidence? }
     */
    public function store(Request $request, MarketingAsset $marketingAsset): JsonResponse
    {
        $data = $request->validate([
            'related_type' => ['required', 'string'],
            'related_id' => ['required', 'string'],
            'confidence' => ['sometimes', 'integer', 'min:0', 'max:100'],
        ]);

        $rel = $this->mapAsset->execute(
            assetId: $marketingAsset->id,
            relatedType: $data['related_type'],
            relatedId: $data['related_id'],
            actorId: (string) (string) $request->user()->id,
            confidence: $data['confidence'] ?? 100,
            isAutoSuggested: false,
        );

        return response()->json(['data' => $rel], 201);
    }

    /**
     * DELETE /marketing/relationships/{relationship}
     */
    public function destroy(MarketingAssetRelationship $relationship): JsonResponse
    {
        $relationship->delete();

        return response()->json(null, 204);
    }

    /**
     * POST /marketing/relationships/{relationship}/accept
     */
    public function accept(Request $request, MarketingAssetRelationship $relationship): JsonResponse
    {
        $rel = $this->mapAsset->accept($relationship->id, (string) (string) $request->user()->id);

        return response()->json(['data' => $rel]);
    }

    /**
     * POST /marketing/relationships/{relationship}/reject
     */
    public function reject(Request $request, MarketingAssetRelationship $relationship): JsonResponse
    {
        $rel = $this->mapAsset->reject($relationship->id, (string) (string) $request->user()->id);

        return response()->json(['data' => $rel]);
    }

    /**
     * GET /marketing/suggestions?company_id=xxx
     */
    public function suggestions(Request $request): JsonResponse
    {
        $companyId = $request->string('company_id')->toString();
        $pending = $this->suggestions->pendingForCompany($companyId);

        return response()->json(['data' => $pending]);
    }

    /**
     * GET /marketing/assets/{asset}/graph
     *
     * Returns a graph representation (nodes + edges) of all relationships
     * for the given asset. Consumed by the Relationship Graph tab in the drawer.
     */
    public function graph(MarketingAsset $marketingAsset): JsonResponse
    {
        $graph = $this->graphService->forAsset($marketingAsset);

        return response()->json(['data' => $graph]);
    }
}
