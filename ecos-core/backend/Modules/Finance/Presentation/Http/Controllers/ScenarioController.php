<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Intelligence\Domain\Services\ScenarioEngine;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Read-only scenario analysis — what-if simulation over the derived P&L. Writes
 * nothing; the ledger is never modified.
 */
class ScenarioController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly ScenarioEngine $engine) {}

    public function simulate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'revenue_pct' => ['nullable', 'numeric'],
            'cogs_pct' => ['nullable', 'numeric'],
            'opex_pct' => ['nullable', 'numeric'],
            'other_expense_pct' => ['nullable', 'numeric'],
            'margin_target_pct' => ['nullable', 'numeric'],
        ]);

        [$from, $to] = $this->financeWindow($request);

        return response()->json(['data' => $this->engine->simulate(
            $this->companyId($request), $from, $to, array_map(static fn ($v) => (float) $v, $validated),
        )]);
    }
}
