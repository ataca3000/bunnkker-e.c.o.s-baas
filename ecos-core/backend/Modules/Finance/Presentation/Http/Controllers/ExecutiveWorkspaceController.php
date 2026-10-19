<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;
use Modules\Finance\Workspace\Domain\Services\ExecutiveWorkspaceService;

/** The Executive Financial Workspace — read-only enterprise dashboard. */
class ExecutiveWorkspaceController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly ExecutiveWorkspaceService $service) {}

    public function overview(Request $request): JsonResponse
    {
        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->service->overview($this->companyId($request), $from, $to)]);
    }
}
