<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Closing\Domain\Models\PeriodClosure;
use Modules\Finance\Closing\Domain\Services\PeriodClosingService;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Period closing — soft close, hard close and the authorised reopen. Orchestrates
 * the F1 fiscal transitions; the ledger is never touched.
 */
class PeriodClosingController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly PeriodClosingService $service) {}

    public function softClose(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $period = $this->service->softClose($this->period($request, $uuid), $this->actorId($request), $validated['reason'] ?? null);

        return response()->json(['data' => $this->payload($period)]);
    }

    public function hardClose(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $period = $this->service->hardClose($this->period($request, $uuid), $this->actorId($request), $validated['reason'] ?? null);

        return response()->json(['data' => $this->payload($period)]);
    }

    public function reopen(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'max:500']]);
        $period = $this->service->reopen($this->period($request, $uuid), (int) $this->actorId($request), $validated['reason']);

        return response()->json(['data' => $this->payload($period)]);
    }

    public function history(Request $request, string $uuid): JsonResponse
    {
        $period = $this->period($request, $uuid);
        $log = PeriodClosure::query()->where('fiscal_period_id', $period->id)->latest('id')->get()
            ->map(fn (PeriodClosure $c) => [
                'action' => $c->action,
                'close_type' => $c->close_type,
                'from' => $c->from_status,
                'to' => $c->to_status,
                'reason' => $c->reason,
                'actor_id' => $c->actor_id,
                'at' => $c->created_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $log]);
    }

    private function period(Request $request, string $uuid): FiscalPeriod
    {
        return FiscalPeriod::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(FiscalPeriod $p): array
    {
        return ['id' => $p->uuid, 'name' => $p->name, 'status' => $p->status->value];
    }
}
