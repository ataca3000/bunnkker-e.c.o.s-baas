<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Logistics\Distribution\Domain\Enums\DeliveryStopStatus;
use Modules\Logistics\Distribution\Domain\Enums\TripReturnKind;
use Modules\Logistics\Distribution\Domain\Exceptions\DistributionException;
use Modules\Logistics\Distribution\Domain\Models\DeliveryException;
use Modules\Logistics\Distribution\Domain\Models\DeliveryStop;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Distribution\Domain\Models\TripReturn;
use Modules\Logistics\Distribution\Domain\Services\DeliveryService;
use Modules\Logistics\Distribution\Presentation\Http\Resources\DeliveryActionResource;
use Modules\Logistics\Distribution\Presentation\Http\Resources\DeliveryExceptionResource;
use Modules\Logistics\Distribution\Presentation\Http\Resources\DeliveryProofResource;
use Modules\Logistics\Distribution\Presentation\Http\Resources\DeliveryStopResource;
use Modules\Logistics\Distribution\Presentation\Http\Resources\TripReturnResource;

class DeliveryController extends Controller
{
    public function __construct(
        private readonly DeliveryService $delivery,
    ) {}

    public function options(): JsonResponse
    {
        return response()->json([
            'stop_statuses' => DeliveryStopStatus::options(),
            'return_kinds' => TripReturnKind::options(),
        ]);
    }

    // ── Stops ────────────────────────────────────────────────────────────────

    public function stops(string $tripId): AnonymousResourceCollection
    {
        $trip = $this->resolveTrip($tripId);

        return DeliveryStopResource::collection(
            $trip->stops()->with(['actions', 'proof', 'payments'])->get()
        );
    }

    /** Build the stop list from the trip's assigned orders. Idempotent. */
    public function generateStops(string $tripId): JsonResponse
    {
        $created = $this->delivery->generateStops($this->resolveTrip($tripId));

        return response()->json([
            'created' => $created,
            'message' => "{$created} stop(s) generated.",
        ], 201);
    }

    public function showStop(string $tripId, int $stopId): DeliveryStopResource
    {
        return new DeliveryStopResource($this->findStop($tripId, $stopId));
    }

    public function startStop(Request $request, string $tripId, int $stopId): JsonResponse|DeliveryStopResource
    {
        try {
            $stop = $this->delivery->startStop($this->findStop($tripId, $stopId), $this->actor($request));
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return new DeliveryStopResource($stop);
    }

    public function completeStop(Request $request, string $tripId, int $stopId): JsonResponse|DeliveryStopResource
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(DeliveryStopStatus::values())],
            'delivery_type' => ['nullable', 'string', 'max:40'],
            'collected_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'string', 'max:30'],
            'gps_lat' => ['nullable', 'numeric', 'between:-90,90'],
            'gps_lng' => ['nullable', 'numeric', 'between:-180,180'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $outcome = DeliveryStopStatus::from($validated['status']);
        unset($validated['status']);

        try {
            $stop = $this->delivery->completeStop(
                $this->findStop($tripId, $stopId),
                $outcome,
                array_filter($validated, static fn ($v) => $v !== null),
                $this->actor($request),
            );
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return new DeliveryStopResource($stop->load(['actions', 'proof', 'payments']));
    }

    // ── Actions & proof ──────────────────────────────────────────────────────

    public function recordAction(Request $request, string $tripId, int $stopId): JsonResponse
    {
        $validated = $request->validate([
            'action_type' => ['required', 'string', 'max:40'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'new_delivery_date' => ['nullable', 'date'],
            'corrected_lat' => ['nullable', 'numeric', 'between:-90,90'],
            'corrected_lng' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $action = $this->delivery->recordAction(
            $this->findStop($tripId, $stopId),
            $validated,
            $request->user()?->id,
        );

        return (new DeliveryActionResource($action))->response()->setStatusCode(201);
    }

    public function captureProof(Request $request, string $tripId, int $stopId): JsonResponse
    {
        $validated = $request->validate([
            'signature_path' => ['nullable', 'string', 'max:500'],
            'photos' => ['nullable', 'array'],
            'photos.*' => ['string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $proof = $this->delivery->captureProof(
            $this->findStop($tripId, $stopId),
            $validated,
            $request->user()?->id,
        );

        return (new DeliveryProofResource($proof))->response()->setStatusCode(201);
    }

    // ── Exceptions ───────────────────────────────────────────────────────────

    public function exceptions(string $tripId): AnonymousResourceCollection
    {
        return DeliveryExceptionResource::collection($this->resolveTrip($tripId)->exceptions()->get());
    }

    public function raiseException(Request $request, string $tripId): JsonResponse
    {
        $validated = $request->validate([
            'exception_type' => ['required', 'string', 'max:50'],
            'description' => ['required', 'string', 'max:5000'],
            'stop_id' => ['nullable', 'integer', 'exists:distribution_delivery_stops,id'],
            'order_id' => ['nullable', 'uuid', 'exists:orders,id'],
            'photos' => ['nullable', 'array'],
            'photos.*' => ['string', 'max:500'],
        ]);

        $exception = $this->delivery->raiseException(
            $this->resolveTrip($tripId),
            $validated,
            $request->user()?->id,
        );

        return (new DeliveryExceptionResource($exception))->response()->setStatusCode(201);
    }

    public function resolveException(Request $request, string $tripId, int $exceptionId): DeliveryExceptionResource
    {
        $validated = $request->validate([
            'resolution_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $exception = DeliveryException::where('trip_id', $this->resolveTrip($tripId)->id)->findOrFail($exceptionId);

        return new DeliveryExceptionResource(
            $this->delivery->resolveException($exception, $validated['resolution_notes'] ?? null, $request->user()?->id)
        );
    }

    // ── Returns (product + custody, unified) ─────────────────────────────────

    public function returns(string $tripId): AnonymousResourceCollection
    {
        return TripReturnResource::collection($this->resolveTrip($tripId)->returns()->get());
    }

    public function recordReturn(Request $request, string $tripId): JsonResponse
    {
        $validated = $request->validate([
            'kind' => ['required', Rule::in(TripReturnKind::values())],
            // Product returns
            'order_id' => ['required_if:kind,product', 'nullable', 'uuid', 'exists:orders,id'],
            'product_id' => ['required_if:kind,product', 'nullable', 'uuid', 'exists:products,id'],
            'product_name' => ['nullable', 'string', 'max:255'],
            'disposition' => ['nullable', Rule::in(['full', 'partial'])],
            // Custody returns
            'custody_type' => ['required_if:kind,custody', 'nullable', 'string', 'max:40'],
            // Shared
            'dispatched_qty' => ['nullable', 'numeric', 'min:0'],
            'returned_qty' => ['required', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'photos' => ['nullable', 'array'],
            'photos.*' => ['string', 'max:500'],
        ]);

        $return = $this->delivery->recordReturn(
            $this->resolveTrip($tripId),
            $validated,
            $request->user()?->id,
        );

        return (new TripReturnResource($return))->response()->setStatusCode(201);
    }

    public function confirmReturn(Request $request, string $tripId, int $returnId): TripReturnResource
    {
        $validated = $request->validate([
            'warehouse_confirmed_qty' => ['required', 'numeric', 'min:0'],
            'driver_liable' => ['sometimes', 'boolean'],
        ]);

        $return = TripReturn::where('trip_id', $this->resolveTrip($tripId)->id)->findOrFail($returnId);

        return new TripReturnResource($this->delivery->confirmReturn(
            $return,
            (float) $validated['warehouse_confirmed_qty'],
            (bool) ($validated['driver_liable'] ?? false),
            $request->user()?->id,
        ));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────


    /** Resolve a trip by its public UUID identifier. */
    private function resolveTrip(string $tripId): Trip
    {
        return Trip::where('uuid', $tripId)->firstOrFail();
    }

    private function findStop(string $tripId, int $stopId): DeliveryStop
    {
        return DeliveryStop::where('trip_id', $this->resolveTrip($tripId)->id)->findOrFail($stopId);
    }

    private function actor(Request $request): ?string
    {
        $user = $request->user();

        return $user?->name ?? $user?->email;
    }
}
