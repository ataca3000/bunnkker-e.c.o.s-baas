<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;
use Modules\Finance\Shared\Domain\Services\ControlAccountReconciliationService;

/**
 * Control-account reconciliation — the subledger-to-GL integrity proof. Reports
 * the GL control balance against the party-ledger total for AR and AP; a
 * non-zero difference is a defect, surfaced rather than hidden.
 */
class ControlReconciliationController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly ControlAccountReconciliationService $reconciliation) {}

    public function receivable(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->reconciliation->receivable($this->companyId($request))]);
    }

    public function payable(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->reconciliation->payable($this->companyId($request))]);
    }
}
