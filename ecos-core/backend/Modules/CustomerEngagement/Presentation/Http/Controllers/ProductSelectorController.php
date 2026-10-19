<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CustomerEngagement\Application\Services\ProductSelectorService;

class ProductSelectorController extends Controller
{
    public function __construct(private readonly ProductSelectorService $selectorService) {}

    public function search(Request $request): JsonResponse
    {
        $request->validate(['q' => 'required|string|min:1']);

        $results = $this->selectorService->search(
            $request->input('q'),
            $request->input('company_id'),
            (int) $request->input('limit', 20),
        );

        return response()->json(['data' => $results]);
    }

    public function show(string $productId): JsonResponse
    {
        $product = $this->selectorService->getProductDetails($productId);
        if (! $product) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json($product);
    }
}
