<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Closing\Domain\Models\ClosingRun;
use Modules\Finance\Closing\Domain\Services\ClosingService;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * The closing-run workflow: start → validate → close. A run validates the live
 * checklist and scores readiness; it closes only when every blocking check
 * passes, and the approver may not be the initiator (maker/checker).
 */
class ClosingController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly ClosingService $service) {}

    public function start(Request $request, string $periodUuid): JsonResponse
    {
        $period = FiscalPeriod::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $periodUuid)
            ->firstOrFail();

        $run = $this->service->startPeriodRun($period, $this->actorId($request));

        return response()->json(['data' => $this->payload($run)], 201);
    }

    public function validateRun(Request $request, string $uuid): JsonResponse
    {
        $run = $this->service->validate($this->find($request, $uuid));

        return response()->json(['data' => $this->payload($run->load('items'), true)]);
    }

    public function close(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $run = $this->service->close($this->find($request, $uuid), (int) $this->actorId($request), $validated['reason'] ?? null);

        return response()->json(['data' => $this->payload($run)]);
    }

    public function show(Request $request, string $uuid): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->find($request, $uuid)->load('items'), true)]);
    }

    private function find(Request $request, string $uuid): ClosingRun
    {
        return ClosingRun::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(ClosingRun $run, bool $withItems = false): array
    {
        return [
            'id' => $run->uuid,
            'scope' => $run->scope,
            'status' => $run->status->value,
            'readiness_score' => $run->readiness_score !== null ? (float) $run->readiness_score : null,
            'validated_at' => $run->validated_at?->toIso8601String(),
            'closed_at' => $run->closed_at?->toIso8601String(),
            'items' => $withItems && $run->relationLoaded('items') ? $run->items->map(fn ($i) => [
                'key' => $i->key,
                'label' => $i->label,
                'category' => $i->category,
                'status' => $i->status->value,
                'is_blocking' => (bool) $i->is_blocking,
                'detail' => $i->detail,
            ])->all() : null,
        ];
    }
}
