<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Closing\Domain\Models\YearEndClosing;
use Modules\Finance\Closing\Domain\Services\YearEndClosingService;
use Modules\Finance\Fiscal\Domain\Models\FiscalYear;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Year-end closing: run (repeatable) and finalize (immutable). Running sweeps P&L
 * to retained earnings and carries balances forward; finalizing freezes it.
 */
class YearEndController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly YearEndClosingService $service) {}

    public function close(Request $request, string $yearUuid): JsonResponse
    {
        $validated = $request->validate([
            'retained_earnings_account_id' => ['required', 'string'], // uuid
            'next_fiscal_year_id' => ['nullable', 'string'],          // uuid
        ]);

        $year = $this->year($request, $yearUuid);
        $nextYear = isset($validated['next_fiscal_year_id']) ? $this->year($request, $validated['next_fiscal_year_id']) : null;

        $closing = $this->service->close(
            year: $year,
            retainedEarningsAccountId: $this->accountId($request, $validated['retained_earnings_account_id']),
            nextYear: $nextYear,
            actorId: $this->actorId($request),
        );

        return response()->json(['data' => $this->payload($closing)]);
    }

    public function finalize(Request $request, string $uuid): JsonResponse
    {
        $closing = YearEndClosing::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();

        return response()->json(['data' => $this->payload($this->service->finalize($closing, (int) $this->actorId($request)))]);
    }

    public function show(Request $request, string $yearUuid): JsonResponse
    {
        $year = $this->year($request, $yearUuid);
        $closing = YearEndClosing::query()->where('company_id', $this->companyId($request))->where('fiscal_year_id', $year->id)->first();

        return response()->json(['data' => $closing !== null ? $this->payload($closing) : null]);
    }

    private function year(Request $request, string $uuid): FiscalYear
    {
        return FiscalYear::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(YearEndClosing $c): array
    {
        return [
            'id' => $c->uuid,
            'status' => $c->status->value,
            'net_income' => (float) $c->net_income,
            'run_count' => $c->run_count,
            'pnl_closing_journal_id' => $c->pnl_closing_journal_id,
            'opening_journal_id' => $c->opening_journal_id,
            'closed_at' => $c->closed_at?->toIso8601String(),
            'finalized_at' => $c->finalized_at?->toIso8601String(),
        ];
    }
}
