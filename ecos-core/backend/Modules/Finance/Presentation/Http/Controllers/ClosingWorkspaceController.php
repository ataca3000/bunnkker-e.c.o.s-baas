<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Closing\Domain\Services\ClosingWorkspaceService;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * The Financial Closing Workspace dashboard — closing progress, open tasks,
 * reconciliation status, pending journals, budget/VAT status, control exceptions
 * and the close-readiness score for a period. Read-only.
 */
class ClosingWorkspaceController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly ClosingWorkspaceService $service) {}

    public function period(Request $request, string $uuid): JsonResponse
    {
        $period = FiscalPeriod::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();

        return response()->json(['data' => $this->service->forPeriod($period)]);
    }
}
