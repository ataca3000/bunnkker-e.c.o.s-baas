<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\RepairEngine;

class RepairDashboardController
{
    use HasApiResponse;

    public function __construct(
        private readonly RepairEngine $engine,
    ) {}

    public function index(): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        return $this->success($this->engine->getDashboard($companyId));
    }
}
