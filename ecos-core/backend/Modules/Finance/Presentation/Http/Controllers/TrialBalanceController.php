<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Ledger\Domain\Services\TrialBalanceService;

/**
 * The Trial Balance read model. The UI reads this; it never computes a balance
 * itself.
 */
class TrialBalanceController extends Controller
{
    public function __construct(private readonly TrialBalanceService $trialBalance) {}

    public function show(Request $request): JsonResponse
    {
        $companyId = (string) $request->user()->company_id;

        // Optional period scope (by uuid).
        $periodId = null;
        if ($request->filled('period_id')) {
            $period = FiscalPeriod::query()
                ->where('company_id', $companyId)
                ->where('uuid', $request->string('period_id'))
                ->first();
            $periodId = $period?->id;
        }

        return response()->json(['data' => $this->trialBalance->forPeriod($companyId, $periodId)]);
    }
}
