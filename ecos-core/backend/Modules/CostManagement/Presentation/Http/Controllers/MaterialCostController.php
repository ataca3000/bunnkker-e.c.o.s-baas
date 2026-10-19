<?php

declare(strict_types=1);

namespace Modules\CostManagement\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\CostManagement\Domain\Enums\CostUpdateSource;
use Modules\CostManagement\Domain\Models\MaterialCostHistory;
use Modules\CostManagement\Domain\Services\MaterialCostService;
use Modules\CostManagement\Presentation\Http\Requests\UpdateMaterialCostRequest;
use Modules\CostManagement\Presentation\Http\Resources\MaterialCostHistoryResource;
use Modules\Inventory\Products\Domain\Models\Product;

class MaterialCostController extends Controller
{
    public function __construct(
        private readonly MaterialCostService $service,
    ) {}

    /**
     * GET /cost-management/materials/{productId}/cost-history
     * List material cost history for a given material product.
     */
    public function history(Request $request, string $productId): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 30);

        $history = MaterialCostHistory::query()
            ->where('product_id', $productId)
            ->orderByDesc('occurred_at')
            ->paginate($perPage);

        return response()->json([
            'data' => MaterialCostHistoryResource::collection($history->items()),
            'pagination' => [
                'total' => $history->total(),
                'per_page' => $history->perPage(),
                'current_page' => $history->currentPage(),
                'last_page' => $history->lastPage(),
            ],
        ]);
    }

    /**
     * GET /cost-management/cost-history
     * Global material cost history across all materials.
     */
    public function globalHistory(Request $request): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 30);
        $search = $request->query('search');
        $source = $request->query('source');
        $from = $request->query('from');
        $to = $request->query('to');

        $query = MaterialCostHistory::query()
            ->with('product')
            ->orderByDesc('occurred_at');

        if ($search) {
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('sku', 'ilike', "%{$search}%");
            });
        }

        if ($source && in_array($source, ['manual', 'purchase_invoice'], true)) {
            $query->where('source', $source);
        }

        if ($from) {
            $query->whereDate('occurred_at', '>=', $from);
        }

        if ($to) {
            $query->whereDate('occurred_at', '<=', $to);
        }

        $history = $query->paginate($perPage);

        return response()->json([
            'data' => MaterialCostHistoryResource::collection($history->items()),
            'pagination' => [
                'total' => $history->total(),
                'per_page' => $history->perPage(),
                'current_page' => $history->currentPage(),
                'last_page' => $history->lastPage(),
            ],
        ]);
    }

    /**
     * PATCH /cost-management/materials/{productId}/cost
     * Manually update a material's cost and trigger cascade.
     */
    public function update(UpdateMaterialCostRequest $request, string $productId): JsonResponse
    {
        $material = Product::query()->findOrFail($productId);
        $newCost = (float) $request->validated('material_cost');

        // Resolve user name from auth context
        $updatedBy = $request->user()?->name ?? $request->user()?->email;

        $history = $this->service->update(
            material: $material,
            newCost: $newCost,
            source: CostUpdateSource::Manual,
            meta: [
                'updated_by' => $updatedBy,
                'reason' => $request->validated('reason'),
            ],
        );

        return response()->json([
            'message' => 'Material cost updated and cascade triggered.',
            'history' => new MaterialCostHistoryResource($history),
        ]);
    }
}
