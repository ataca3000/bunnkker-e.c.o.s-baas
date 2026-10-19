<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\Purchasing\Suppliers\Application\Queries\GetProcurementHealthQuery;
use Modules\Purchasing\Suppliers\Application\Queries\GetSupplierAnalyticsQuery;
use Modules\Purchasing\Suppliers\Application\Queries\GetSupplierInventoryBreakdownQuery;
use Modules\Purchasing\Suppliers\Application\Queries\GetSupplierPriceHistoryQuery;
use Modules\Purchasing\Suppliers\Application\Queries\GetSupplierSummaryStatsQuery;
use Modules\Purchasing\Suppliers\Application\Queries\GetSupplierTimelineQuery;
use Modules\Purchasing\Suppliers\Presentation\Http\Resources\SupplierAnalyticsResource;
use Modules\Purchasing\Suppliers\Presentation\Http\Resources\SupplierInventoryProductResource;

final class SupplierAnalyticsController extends Controller
{
    use HasApiResponse;

    public function summaryStats(GetSupplierSummaryStatsQuery $query): JsonResponse
    {
        return $this->success($query->execute());
    }

    public function analytics(
        string $supplier,
        GetSupplierAnalyticsQuery $query,
    ): JsonResponse {
        $data = $query->execute($supplier);

        return $this->success(new SupplierAnalyticsResource($data));
    }

    public function inventoryBreakdown(
        string $supplier,
        GetSupplierInventoryBreakdownQuery $query,
    ): JsonResponse {
        $products = $query->execute($supplier);

        return $this->success(
            $products->map(fn (array $p) => new SupplierInventoryProductResource($p))->values(),
        );
    }

    public function health(
        string $supplier,
        GetProcurementHealthQuery $query,
    ): JsonResponse {
        return $this->success($query->execute($supplier));
    }

    public function priceHistory(
        string $supplier,
        GetSupplierPriceHistoryQuery $query,
    ): JsonResponse {
        return $this->success($query->execute($supplier)->values());
    }

    public function timeline(
        string $supplier,
        GetSupplierTimelineQuery $query,
    ): JsonResponse {
        return $this->success($query->execute($supplier)->values());
    }
}
