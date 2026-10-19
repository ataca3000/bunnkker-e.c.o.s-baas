<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;
use Modules\Finance\Workspace\Domain\Services\CfoWorkspaceService;

/** The CFO Workspace — read-only daily decision surface. */
class CfoWorkspaceController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly CfoWorkspaceService $service) {}

    public function overview(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->service->overview($this->companyId($request))]);
    }
}
