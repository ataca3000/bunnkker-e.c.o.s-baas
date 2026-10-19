<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryControl\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Inventory\InventoryControl\Application\Services\WarehousePerformanceService;

final class WarehousePerformanceController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly WarehousePerformanceService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $months = $request->integer('months', 12);

        return $this->success(
            $this->service->allWarehouses($months),
        );
    }
}
