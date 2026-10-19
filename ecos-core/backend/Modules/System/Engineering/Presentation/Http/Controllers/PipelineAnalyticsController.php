<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\System\Engineering\Application\Services\PipelineAnalyticsService;

final class PipelineAnalyticsController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly PipelineAnalyticsService $analytics,
    ) {}

    /** GET /api/system/engineering/analytics */
    public function index(): JsonResponse
    {
        return $this->success($this->analytics->getDashboardMetrics());
    }
}
