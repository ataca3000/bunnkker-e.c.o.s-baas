<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;
use Modules\Finance\Vat\Domain\Models\VatPeriod;
use Modules\Finance\Vat\Domain\Services\VatService;

/**
 * VAT Operations: periods, derived returns, settlement and reports. The VAT
 * engine is independent (no ETA/e-invoicing); settlement posts through the
 * Posting Engine.
 */
class VatController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly VatService $service) {}

    public function index(Request $request): JsonResponse
    {
        $periods = VatPeriod::query()
            ->where('company_id', $this->companyId($request))
            ->latest('id')->limit(60)->get()
            ->map(fn (VatPeriod $p) => $this->payload($p));

        return response()->json(['data' => $periods]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
        ]);

        $period = $this->service->createPeriod(
            $this->companyId($request), $validated['name'],
            Carbon::parse($validated['start_date']), Carbon::parse($validated['end_date']), $this->actorId($request),
        );

        return response()->json(['data' => $this->payload($period)], 201);
    }

    public function report(Request $request, string $uuid): JsonResponse
    {
        return response()->json(['data' => $this->service->report($this->period($request, $uuid))]);
    }

    public function generateReturn(Request $request, string $uuid): JsonResponse
    {
        $return = $this->service->generateReturn($this->period($request, $uuid));

        return response()->json(['data' => [
            'id' => $return->uuid,
            'output_vat' => (float) $return->output_vat,
            'input_vat_recoverable' => (float) $return->input_vat_recoverable,
            'input_vat_non_recoverable' => (float) $return->input_vat_non_recoverable,
            'net_payable' => (float) $return->net_payable,
            'status' => $return->status,
        ]], 201);
    }

    public function settle(Request $request, string $uuid): JsonResponse
    {
        $period = $this->service->settle($this->period($request, $uuid), $this->actorId($request));

        return response()->json(['data' => $this->payload($period)]);
    }

    private function period(Request $request, string $uuid): VatPeriod
    {
        return VatPeriod::query()->where('company_id', $this->companyId($request))->where('uuid', $uuid)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(VatPeriod $p): array
    {
        return [
            'id' => $p->uuid,
            'name' => $p->name,
            'start_date' => $p->start_date?->toDateString(),
            'end_date' => $p->end_date?->toDateString(),
            'status' => $p->status->value,
            'settlement_journal_id' => $p->settlement_journal_id,
        ];
    }
}
