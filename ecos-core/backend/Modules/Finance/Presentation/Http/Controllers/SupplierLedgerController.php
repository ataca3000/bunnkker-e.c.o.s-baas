<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Finance\Payables\Domain\Services\ApAgingService;
use Modules\Finance\Payables\Domain\Services\SupplierLedgerService;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Supplier ledger read models: running history, statement, balance and aging.
 * Derived from the append-only supplier ledger — nothing stored.
 */
class SupplierLedgerController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(
        private readonly SupplierLedgerService $ledger,
        private readonly ApAgingService $aging,
    ) {}

    public function history(Request $request, string $supplierId): JsonResponse
    {
        $from = $request->filled('from') ? Carbon::parse($request->string('from')) : null;
        $to = $request->filled('to') ? Carbon::parse($request->string('to')) : null;

        return response()->json(['data' => $this->ledger->history($this->companyId($request), $supplierId, $from, $to)]);
    }

    public function statement(Request $request, string $supplierId): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);

        return response()->json(['data' => $this->ledger->statement(
            $this->companyId($request),
            $supplierId,
            Carbon::parse($validated['from']),
            Carbon::parse($validated['to']),
        )]);
    }

    public function balance(Request $request, string $supplierId): JsonResponse
    {
        return response()->json(['data' => [
            'supplier_id' => $supplierId,
            'balance' => $this->ledger->balance($this->companyId($request), $supplierId),
        ]]);
    }

    public function aging(Request $request): JsonResponse
    {
        $asOf = $request->filled('as_of') ? Carbon::parse($request->string('as_of')) : null;
        $supplierId = $request->filled('supplier_id') ? (string) $request->string('supplier_id') : null;

        return response()->json(['data' => $this->aging->report($this->companyId($request), $asOf, $supplierId)]);
    }
}
