<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Logistics\Distribution\Domain\Enums\PaymentType;
use Modules\Logistics\Distribution\Domain\Enums\SettlementStatus;
use Modules\Logistics\Distribution\Domain\Exceptions\DistributionException;
use Modules\Logistics\Distribution\Domain\Models\DeliveryStop;
use Modules\Logistics\Distribution\Domain\Models\PaymentCollection;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Distribution\Domain\Models\TripSettlement;
use Modules\Logistics\Distribution\Domain\Services\SettlementService;
use Modules\Logistics\Distribution\Presentation\Http\Resources\PaymentCollectionResource;
use Modules\Logistics\Distribution\Presentation\Http\Resources\TripSettlementResource;

class SettlementController extends Controller
{
    public function __construct(
        private readonly SettlementService $settlements,
    ) {}

    public function options(): JsonResponse
    {
        return response()->json([
            'payment_types' => PaymentType::options(),
            'settlement_statuses' => SettlementStatus::options(),
        ]);
    }

    // ── Payment collection ───────────────────────────────────────────────────

    public function payments(string $tripId): AnonymousResourceCollection
    {
        return PaymentCollectionResource::collection(
            $this->resolveTrip($tripId)->paymentCollections()->get()
        );
    }

    public function recordPayment(Request $request, string $tripId, int $stopId): JsonResponse
    {
        $validated = $request->validate([
            'payment_type' => ['required', Rule::in(PaymentType::values())],
            'amount' => ['required', 'numeric', 'min:0'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'image_path' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $stop = DeliveryStop::where('trip_id', $this->resolveTrip($tripId)->id)->findOrFail($stopId);

        try {
            $payment = $this->settlements->recordPayment($stop, $validated, $request->user()?->id);
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return (new PaymentCollectionResource($payment))->response()->setStatusCode(201);
    }

    public function verifyPayment(Request $request, string $tripId, int $paymentId): PaymentCollectionResource
    {
        $payment = PaymentCollection::where('trip_id', $this->resolveTrip($tripId)->id)->findOrFail($paymentId);

        return new PaymentCollectionResource(
            $this->settlements->verifyPayment($payment, $request->user()?->id)
        );
    }

    public function rejectPayment(Request $request, string $tripId, int $paymentId): PaymentCollectionResource
    {
        $validated = $request->validate(['notes' => ['nullable', 'string', 'max:2000']]);

        $payment = PaymentCollection::where('trip_id', $this->resolveTrip($tripId)->id)->findOrFail($paymentId);

        return new PaymentCollectionResource(
            $this->settlements->rejectPayment($payment, $validated['notes'] ?? null, $request->user()?->id)
        );
    }

    // ── Settlement ───────────────────────────────────────────────────────────

    public function show(string $tripId): JsonResponse|TripSettlementResource
    {
        $settlement = TripSettlement::where('trip_id', $this->resolveTrip($tripId)->id)->first();

        if ($settlement === null) {
            return response()->json(['message' => 'No settlement has been opened for this trip.'], 404);
        }

        return new TripSettlementResource($settlement);
    }

    /** Derives the totals from the payment ledger and opens the settlement. */
    public function open(string $tripId): JsonResponse|TripSettlementResource
    {
        try {
            $settlement = $this->settlements->openSettlement($this->resolveTrip($tripId));
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return new TripSettlementResource($settlement);
    }

    public function submitCash(Request $request, string $tripId): JsonResponse|TripSettlementResource
    {
        $validated = $request->validate([
            'driver_cash_submitted' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $settlement = $this->settlements->submitDriverCash(
                $this->findSettlement($tripId),
                (float) $validated['driver_cash_submitted'],
                $validated['notes'] ?? null,
            );
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return new TripSettlementResource($settlement);
    }

    public function reconcile(Request $request, string $tripId): JsonResponse|TripSettlementResource
    {
        $validated = $request->validate(['notes' => ['nullable', 'string', 'max:2000']]);

        try {
            $settlement = $this->settlements->reconcile($this->findSettlement($tripId), $validated['notes'] ?? null);
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return new TripSettlementResource($settlement);
    }

    public function dispute(Request $request, string $tripId): JsonResponse|TripSettlementResource
    {
        $validated = $request->validate(['notes' => ['nullable', 'string', 'max:2000']]);

        try {
            $settlement = $this->settlements->dispute($this->findSettlement($tripId), $validated['notes'] ?? null);
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return new TripSettlementResource($settlement);
    }

    public function finalize(Request $request, string $tripId): JsonResponse|TripSettlementResource
    {
        try {
            $settlement = $this->settlements->finalize(
                $this->findSettlement($tripId),
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return new TripSettlementResource($settlement);
    }

    /** Read-only financial summary for the trip. */
    public function summary(string $tripId): JsonResponse
    {
        return response()->json(
            $this->settlements->financialSummary($this->resolveTrip($tripId))
        );
    }


    /** Resolve a trip by its public UUID identifier. */
    private function resolveTrip(string $tripId): Trip
    {
        return Trip::where('uuid', $tripId)->firstOrFail();
    }

    private function findSettlement(string $tripId): TripSettlement
    {
        return TripSettlement::where('trip_id', $this->resolveTrip($tripId)->id)->firstOrFail();
    }
}
