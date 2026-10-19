<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\GuardianEngine;

class GuardianDashboardController
{
    use HasApiResponse;

    public function __construct(
        private readonly GuardianEngine $engine,
    ) {}

    public function index(): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        return $this->success($this->engine->dashboard($companyId));
    }
}
