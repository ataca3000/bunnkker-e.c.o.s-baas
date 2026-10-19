<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryControl\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\Inventory\InventoryControl\Application\Services\InventoryDashboardService;

final class InventoryDashboardController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly InventoryDashboardService $dashboard,
    ) {}

    public function index(): JsonResponse
    {
        return $this->success([
            'kpis' => $this->dashboard->kpis(),
            'top_negative' => $this->dashboard->topNegativeVariances(10),
            'top_positive' => $this->dashboard->topPositiveVariances(10),
            'recent_sessions' => $this->dashboard->recentSessions(5),
        ]);
    }
}
