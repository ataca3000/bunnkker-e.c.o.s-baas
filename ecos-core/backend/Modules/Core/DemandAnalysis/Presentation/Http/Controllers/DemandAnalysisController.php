<?php

declare(strict_types=1);

namespace Modules\Core\DemandAnalysis\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Core\DemandAnalysis\Application\Services\DemandAnalysisService;
use Modules\Inventory\Products\Domain\Models\Product;

final class DemandAnalysisController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly DemandAnalysisService $service,
    ) {}

    /**
     * GET /demand-analysis/{product}?warehouse_id=&requested_qty=&required_date=
     *
     * Returns comprehensive demand intelligence for a single product.
     * Consumed by: Procurement Panel, Inventory Drawer, Dashboard, Preparation OS.
     */
    public function show(Request $request, Product $product): JsonResponse
    {
        $warehouseId = $request->query('warehouse_id') ?: null;

        $dto = $this->service->analyze($product->id, $warehouseId);

        return $this->success($dto->toArray());
    }
}
