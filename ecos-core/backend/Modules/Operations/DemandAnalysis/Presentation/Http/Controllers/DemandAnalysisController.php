<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use DateTimeInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Operations\DemandAnalysis\Application\DTO\DemandLine;
use Modules\Operations\DemandAnalysis\Application\Services\DemandAnalysisService;

final class DemandAnalysisController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly DemandAnalysisService $service,
    ) {}

    /**
     * Generate the Daily Demand Matrix for the given (or today's) operational day.
     *
     * Query params:
     *   date  Y-m-d  Optional. Defaults to today. (Future use — currently
     *                the query is date-agnostic and covers all open orders.)
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $result = $this->service->analyze($request->query('date'));

        return $this->success([
            'operational_day' => $result->operationalDay,
            'generated_at' => $result->generatedAt->format(DateTimeInterface::RFC3339),
            'summary' => [
                'total_orders' => $result->totalOrders,
                'total_products' => $result->totalProducts,
                'total_skus' => $result->totalSkus,
                'ready_count' => $result->readyCount(),
                'shortage_count' => $result->shortageCount(),
                'out_of_stock_count' => $result->outOfStockCount(),
                'unknown_count' => $result->unknownCount(),
            ],
            'demand_lines' => array_map(
                fn (DemandLine $line) => [
                    'product_id' => $line->productId,
                    'sku' => $line->sku,
                    'product_name' => $line->productName,
                    'ordered_qty' => $line->orderedQty,
                    'reserved_qty' => $line->reservedQty,
                    'available_qty' => $line->availableQty,
                    'required_qty' => $line->requiredQty,
                    'shortage_qty' => $line->shortageQty(),
                    'affected_orders_count' => $line->affectedOrdersCount,
                    'affected_channels_count' => $line->affectedChannelsCount,
                    'warehouse_count' => $line->warehouseCount,
                    'inventory_status' => $line->inventoryStatus->value,
                ],
                $result->demandLines,
            ),
        ]);
    }
}
