<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\CampaignStudio\Application\Services\CommerceIntegrationService;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;

class CommerceIntegrationController extends Controller
{
    public function __construct(private readonly CommerceIntegrationService $commerceService) {}

    /** GET /mkt/studio/drafts/{draft}/products */
    public function index(CampaignDraft $draft): JsonResponse
    {
        return response()->json(['data' => $draft->products]);
    }

    /** POST /mkt/studio/drafts/{draft}/products */
    public function store(Request $request, CampaignDraft $draft): JsonResponse
    {
        $validated = $request->validate([
            'product_type' => ['required', 'in:finished_good,raw_material,category,brand,collection'],
            'product_id' => ['required', 'string', 'max:36'],
            'product_name' => ['nullable', 'string', 'max:500'],
            'product_sku' => ['nullable', 'string', 'max:255'],
            'warn_if_unavailable' => ['sometimes', 'boolean'],
        ]);

        $product = $this->commerceService->linkProduct($draft, $validated);

        return response()->json(['data' => $product], 201);
    }

    /** DELETE /mkt/studio/drafts/{draft}/products/{product} */
    public function destroy(CampaignDraft $draft, string $product): JsonResponse
    {
        $this->commerceService->unlinkProduct($draft, $product);

        return response()->json(null, 204);
    }

    /** POST /mkt/studio/drafts/{draft}/products/refresh */
    public function refresh(CampaignDraft $draft): JsonResponse
    {
        $result = $this->commerceService->refreshAvailability($draft);

        return response()->json(['data' => $result]);
    }
}
