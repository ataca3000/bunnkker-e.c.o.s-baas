<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryControl\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Inventory\InventoryControl\Application\Services\VarianceAnalyticsService;

final class VarianceAnalyticsController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly VarianceAnalyticsService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $limit = $request->integer('limit', 10);

        return $this->success([
            'frequently_missing' => $this->service->frequentlyMissing($limit),
            'frequently_overcounted' => $this->service->frequentlyOvercounted($limit),
            'by_warehouse' => $this->service->byWarehouse(),
            'by_category' => $this->service->byCategory(),
            'monthly_trend' => $this->service->monthlyTrend(),
        ]);
    }
}
