<?php

declare(strict_types=1);

namespace Modules\Logistics\Automation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logistics\Automation\Domain\Services\AutomationMonitoringService;

/**
 * The automation platform's read-only observability surface — policies,
 * metrics and monitoring. It exposes what is wired up; it triggers nothing.
 */
class AutomationController extends Controller
{
    public function __construct(
        private readonly AutomationMonitoringService $monitoring,
    ) {}

    public function policies(): JsonResponse
    {
        return response()->json(['data' => $this->monitoring->policies()]);
    }

    public function monitoring(): JsonResponse
    {
        return response()->json(['data' => $this->monitoring->monitoring()]);
    }

    public function metrics(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->monitoring->metrics($this->companyId($request))]);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
