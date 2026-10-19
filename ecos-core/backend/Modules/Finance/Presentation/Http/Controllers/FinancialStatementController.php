<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Finance\Reporting\Domain\Services\FinancialStatementService;

/**
 * The two statutory statements as read models.
 *
 * Both are scoped to the caller's own company — the company is taken from the
 * authenticated user and never from the request, so no caller can read another
 * tenant's books by changing a parameter.
 */
class FinancialStatementController extends Controller
{
    public function __construct(private readonly FinancialStatementService $statements) {}

    public function incomeStatement(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        return response()->json([
            'data' => $this->statements->incomeStatement(
                (string) $request->user()->company_id,
                Carbon::parse($validated['from'])->startOfDay(),
                Carbon::parse($validated['to'])->endOfDay(),
            ),
        ]);
    }

    public function balanceSheet(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'as_of' => ['sometimes', 'date'],
        ]);

        return response()->json([
            'data' => $this->statements->balanceSheet(
                (string) $request->user()->company_id,
                isset($validated['as_of']) ? Carbon::parse($validated['as_of'])->endOfDay() : Carbon::today(),
            ),
        ]);
    }
}
