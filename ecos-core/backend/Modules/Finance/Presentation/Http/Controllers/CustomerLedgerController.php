<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;
use Modules\Finance\Receivables\Domain\Services\ArAgingService;
use Modules\Finance\Receivables\Domain\Services\CustomerLedgerService;

/**
 * Customer ledger read models: running history, statement, balance and aging.
 * Every figure is derived from the append-only ledger — nothing is stored.
 */
class CustomerLedgerController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(
        private readonly CustomerLedgerService $ledger,
        private readonly ArAgingService $aging,
    ) {}

    public function history(Request $request, string $customerId): JsonResponse
    {
        $from = $request->filled('from') ? Carbon::parse($request->string('from')) : null;
        $to = $request->filled('to') ? Carbon::parse($request->string('to')) : null;

        return response()->json(['data' => $this->ledger->history($this->companyId($request), $customerId, $from, $to)]);
    }

    public function statement(Request $request, string $customerId): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);

        return response()->json(['data' => $this->ledger->statement(
            $this->companyId($request),
            $customerId,
            Carbon::parse($validated['from']),
            Carbon::parse($validated['to']),
        )]);
    }

    public function balance(Request $request, string $customerId): JsonResponse
    {
        return response()->json(['data' => [
            'customer_id' => $customerId,
            'balance' => $this->ledger->balance($this->companyId($request), $customerId),
        ]]);
    }

    public function aging(Request $request): JsonResponse
    {
        $asOf = $request->filled('as_of') ? Carbon::parse($request->string('as_of')) : null;
        $customerId = $request->filled('customer_id') ? (string) $request->string('customer_id') : null;

        return response()->json(['data' => $this->aging->report($this->companyId($request), $asOf, $customerId)]);
    }
}
