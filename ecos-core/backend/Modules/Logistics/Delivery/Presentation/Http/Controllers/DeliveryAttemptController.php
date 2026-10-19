<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Logistics\Delivery\Domain\Contracts\DeliveryRepositoryInterface;
use Modules\Logistics\Delivery\Domain\Enums\AttemptStatus;
use Modules\Logistics\Delivery\Domain\Enums\FailureReason;
use Modules\Logistics\Delivery\Domain\Exceptions\DeliveryException;
use Modules\Logistics\Delivery\Domain\Models\Delivery;
use Modules\Logistics\Delivery\Domain\Models\DeliveryAttempt;
use Modules\Logistics\Delivery\Domain\Services\DeliveryExecutionService;
use Modules\Logistics\Delivery\Presentation\Http\Resources\DeliveryAttemptResource;
use Modules\Logistics\Delivery\Presentation\Http\Resources\DeliveryFailureResource;
use Modules\Logistics\Distribution\Domain\Models\DeliveryStop;

/**
 * Attempt execution — the driver-facing surface.
 *
 * Every gate (trip on the road, driver fit to deliver, vehicle dispatchable,
 * one open attempt at a time) lives in DeliveryExecutionService, so the same
 * rules hold whichever client calls these endpoints.
 */
class DeliveryAttemptController extends Controller
{
    public function __construct(
        private readonly DeliveryRepositoryInterface $deliveries,
        private readonly DeliveryExecutionService $execution,
    ) {}

    public function index(string $deliveryId): AnonymousResourceCollection
    {
        $delivery = $this->delivery($deliveryId);

        return DeliveryAttemptResource::collection(
            $delivery->attempts()->with(['failure', 'pod.artifacts'])->get()
        );
    }

    public function show(string $deliveryId, string $attemptId): DeliveryAttemptResource
    {
        return new DeliveryAttemptResource(
            $this->attempt($deliveryId, $attemptId)->load(['failure', 'pod.artifacts'])
        );
    }

    /**
     * Open an attempt against a Distribution stop.
     *
     * The stop is read-only input: Delivery OS never writes to distribution_*.
     */
    public function store(Request $request, string $deliveryId): JsonResponse
    {
        $validated = $request->validate([
            'stop_id' => ['required', 'integer', 'exists:distribution_delivery_stops,id'],
        ]);

        $delivery = $this->delivery($deliveryId);
        $stop = DeliveryStop::with(['trip.driverVehicleAssignment.driver', 'trip.driverVehicleAssignment.vehicle'])
            ->findOrFail($validated['stop_id']);

        try {
            $attempt = $this->execution->openAttempt(
                $delivery,
                $stop,
                $request->user()?->id,
                $this->actor($request),
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return (new DeliveryAttemptResource($attempt))->response()->setStatusCode(201);
    }

    /** En route → arrived → in progress. */
    public function advance(Request $request, string $deliveryId, string $attemptId): JsonResponse|DeliveryAttemptResource
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(AttemptStatus::values())],
            'gps_lat' => ['nullable', 'numeric', 'between:-90,90'],
            'gps_lng' => ['nullable', 'numeric', 'between:-180,180'],
            'gps_accuracy_m' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $target = AttemptStatus::from($validated['status']);
        unset($validated['status']);

        try {
            $attempt = $this->execution->advanceAttempt(
                $this->attempt($deliveryId, $attemptId),
                $target,
                array_filter($validated, static fn ($v) => $v !== null),
                $this->actor($request),
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new DeliveryAttemptResource($attempt);
    }

    /**
     * Close the attempt successfully.
     *
     * Refuses without a validated POD (BR-7) or with COD still outstanding
     * (BR-8) — both checks live in the service.
     */
    public function succeed(Request $request, string $deliveryId, string $attemptId): JsonResponse|DeliveryAttemptResource
    {
        $validated = $request->validate([
            'partial' => ['nullable', 'boolean'],
        ]);

        try {
            $attempt = $this->execution->succeed(
                $this->attempt($deliveryId, $attemptId),
                (bool) ($validated['partial'] ?? false),
                $request->user()?->id,
                $this->actor($request),
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new DeliveryAttemptResource($attempt->load(['pod.artifacts']));
    }

    /**
     * Close the attempt as failed.
     *
     * The caller supplies a reason code only — retryability, category and the
     * address-correction flag are all derived from the taxonomy, never trusted
     * from the request.
     */
    public function fail(Request $request, string $deliveryId, string $attemptId): JsonResponse
    {
        $validated = $request->validate([
            'reason_code' => ['required', Rule::in(FailureReason::values())],
            'description' => ['nullable', 'string', 'max:2000'],
            'photos' => ['nullable', 'array', 'max:10'],
            'photos.*' => ['string', 'max:500'],
        ]);

        try {
            $failure = $this->execution->fail(
                $this->attempt($deliveryId, $attemptId),
                FailureReason::from($validated['reason_code']),
                $validated['description'] ?? null,
                $validated['photos'] ?? [],
                $request->user()?->id,
                $this->actor($request),
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        // The action is "close this attempt"; the failure record is a side
        // effect, so this stays 200 rather than inheriting 201 from the
        // freshly-created resource.
        return (new DeliveryFailureResource($failure))->response()->setStatusCode(200);
    }

    /** Abandon an attempt that was opened by mistake. Does not consume a retry. */
    public function abort(Request $request, string $deliveryId, string $attemptId): JsonResponse|DeliveryAttemptResource
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $attempt = $this->execution->abortAttempt(
                $this->attempt($deliveryId, $attemptId),
                $validated['reason'] ?? null,
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new DeliveryAttemptResource($attempt);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function delivery(string $deliveryId): Delivery
    {
        return $this->deliveries->findByUuidOrFail($deliveryId);
    }

    /** Scoped by delivery so an attempt UUID from another order 404s. */
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

    private function actor(Request $request): ?string
    {
        return $request->user()?->name;
    }
}
