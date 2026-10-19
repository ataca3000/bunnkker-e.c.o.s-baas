<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Logistics\Delivery\Domain\Contracts\DeliveryRepositoryInterface;
use Modules\Logistics\Delivery\Domain\Exceptions\DeliveryException;
use Modules\Logistics\Delivery\Domain\Models\CodRecord;
use Modules\Logistics\Delivery\Domain\Models\Delivery;
use Modules\Logistics\Delivery\Domain\Models\DeliveryAttempt;
use Modules\Logistics\Delivery\Domain\Services\CodCompletionService;
use Modules\Logistics\Delivery\Presentation\Http\Resources\CodRecordResource;

/**
 * COD completion reporting.
 *
 * ┌─ CTO DECISION 3 — DISTRIBUTION IS THE SINGLE CASH AUTHORITY ─────────────┐
 * │ These endpoints record that money changed hands at the door and publish   │
 * │ CodCollected. They expose no settlement figures, run no reconciliation    │
 * │ arithmetic, and touch no distribution_* table. Trip cash balances and     │
 * │ settlement remain exclusively with Distribution's SettlementService,      │
 * │ reachable at /api/logistics/distribution/trips/{tripId}/settlement.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class DeliveryCodController extends Controller
{
    public function __construct(
        private readonly DeliveryRepositoryInterface $deliveries,
        private readonly CodCompletionService $cod,
    ) {}

    public function show(string $deliveryId): CodRecordResource
    {
        return new CodRecordResource($this->record($deliveryId));
    }

    /**
     * Register the amount the customer owes on arrival.
     *
     * Upsert semantics — always 200, so re-opening with a corrected amount has
     * the same contract as the first call.
     */
    public function open(Request $request, string $deliveryId): JsonResponse
    {
        $validated = $request->validate([
            'amount_due' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
        ]);

        $record = $this->cod->open(
            $this->delivery($deliveryId),
            (float) $validated['amount_due'],
            $validated['currency'] ?? 'EGP',
        );

        return (new CodRecordResource($record))->response()->setStatusCode(200);
    }

    public function collect(Request $request, string $deliveryId): JsonResponse|CodRecordResource
    {
        $validated = $request->validate([
            'attempt_id' => ['required', 'string', 'max:36'],
            'amount' => ['required', 'numeric', 'min:0'],
            'method' => ['nullable', 'string', 'max:30'],
            'reference_number' => ['nullable', 'string', 'max:100'],
        ]);

        $attempt = $this->attempt($deliveryId, $validated['attempt_id']);
        $amount = (float) $validated['amount'];
        unset($validated['attempt_id'], $validated['amount']);

        try {
            $record = $this->cod->collect(
                $this->record($deliveryId),
                $attempt,
                $amount,
                array_filter($validated, static fn ($v) => $v !== null),
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new CodRecordResource($record);
    }

    /** Back-office confirmation that the recorded amount is real. */
    public function verify(Request $request, string $deliveryId): JsonResponse|CodRecordResource
    {
        try {
            $record = $this->cod->verify($this->record($deliveryId), $request->user()?->id);
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new CodRecordResource($record);
    }

    public function dispute(Request $request, string $deliveryId): JsonResponse|CodRecordResource
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        try {
            $record = $this->cod->dispute(
                $this->record($deliveryId),
                $validated['reason'],
                $request->user()?->id,
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new CodRecordResource($record);
    }

    public function writeOff(Request $request, string $deliveryId): JsonResponse|CodRecordResource
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        try {
            $record = $this->cod->writeOff(
                $this->record($deliveryId),
                $validated['reason'],
                $request->user()?->id,
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new CodRecordResource($record);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function delivery(string $deliveryId): Delivery
    {
        return $this->deliveries->findByUuidOrFail($deliveryId);
    }

    private function record(string $deliveryId): CodRecord
    {
        return $this->delivery($deliveryId)->codRecord()->firstOrFail();
    }

    private function attempt(string $deliveryId, string $attemptId): DeliveryAttempt
    {
        return DeliveryAttempt::query()
            ->where('uuid', $attemptId)
            ->whereHas('delivery', fn ($q) => $q->where('uuid', $deliveryId))
            ->firstOrFail();
    }

    private function unprocessable(DeliveryException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage()], 422);
    }
}
