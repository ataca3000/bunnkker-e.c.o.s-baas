<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Logistics\Delivery\Domain\Contracts\DeliveryRepositoryInterface;
use Modules\Logistics\Delivery\Domain\Exceptions\DeliveryException;
use Modules\Logistics\Delivery\Domain\Models\Delivery;
use Modules\Logistics\Delivery\Domain\Models\DeliveryAttempt;
use Modules\Logistics\Delivery\Domain\Models\DeliveryReturn;
use Modules\Logistics\Delivery\Domain\Services\DeliveryReturnService;
use Modules\Logistics\Delivery\Presentation\Http\Resources\DeliveryReturnResource;

/**
 * Customer returns — what the customer did not accept.
 *
 * Distinct from Distribution's TripReturn, which records what physically came
 * back on the vehicle. Both exist by design (CTO decisions 1 and 2): this one
 * is per-order and reconciles against the warehouse count line by line.
 */
class DeliveryReturnController extends Controller
{
    public function __construct(
        private readonly DeliveryRepositoryInterface $deliveries,
        private readonly DeliveryReturnService $returns,
    ) {}

    public function index(string $deliveryId): AnonymousResourceCollection
    {
        return DeliveryReturnResource::collection(
            $this->delivery($deliveryId)->returns()->with('lines')->get()
        );
    }

    public function show(string $deliveryId, string $returnId): DeliveryReturnResource
    {
        return new DeliveryReturnResource($this->findReturn($deliveryId, $returnId)->load('lines'));
    }

    /**
     * BR-24: each line's returned quantity may not exceed what the customer
     * failed to take. Enforced per line inside the service transaction, so a
     * single bad line rolls the whole return back.
     */
    public function store(Request $request, string $deliveryId): JsonResponse|DeliveryReturnResource
    {
        $validated = $request->validate([
            'attempt_id' => ['nullable', 'string', 'max:36'],
            'reason_code' => ['nullable', 'string', 'max:50'],
            'reason' => ['nullable', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => ['nullable', 'string', 'max:36'],
            'lines.*.product_name' => ['nullable', 'string', 'max:255'],
            'lines.*.ordered_qty' => ['required', 'numeric', 'min:0'],
            'lines.*.delivered_qty' => ['required', 'numeric', 'min:0'],
            'lines.*.returned_qty' => ['required', 'numeric', 'min:0'],
            'lines.*.notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $lines = $validated['lines'];
        $attemptUuid = $validated['attempt_id'] ?? null;
        unset($validated['lines'], $validated['attempt_id']);

        $attempt = $attemptUuid === null ? null : $this->attempt($deliveryId, $attemptUuid);

        try {
            $return = $this->returns->initiate(
                $this->delivery($deliveryId),
                $lines,
                array_filter($validated, static fn ($v) => $v !== null),
                $attempt,
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return (new DeliveryReturnResource($return->load('lines')))
            ->response()
            ->setStatusCode(201);
    }

    public function markInTransit(string $deliveryId, string $returnId): JsonResponse|DeliveryReturnResource
    {
        try {
            $return = $this->returns->markInTransit($this->findReturn($deliveryId, $returnId));
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new DeliveryReturnResource($return->load('lines'));
    }

    /**
     * Warehouse receipt. The caller supplies counted quantities only; the
     * discrepancy is derived, never accepted from the request.
     */
    public function receive(Request $request, string $deliveryId, string $returnId): JsonResponse|DeliveryReturnResource
    {
        $validated = $request->validate([
            'confirmed' => ['required', 'array', 'min:1'],
            'confirmed.*' => ['numeric', 'min:0'],
        ]);

        $confirmed = [];
        foreach ($validated['confirmed'] as $lineId => $qty) {
            $confirmed[(int) $lineId] = (float) $qty;
        }

        try {
            $return = $this->returns->receive(
                $this->findReturn($deliveryId, $returnId),
                $confirmed,
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new DeliveryReturnResource($return->load('lines'));
    }

    public function verify(Request $request, string $deliveryId, string $returnId): JsonResponse|DeliveryReturnResource
    {
        try {
            $return = $this->returns->verify(
                $this->findReturn($deliveryId, $returnId),
                $request->user()?->id,
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new DeliveryReturnResource($return->load('lines'));
    }

    public function flagDiscrepancy(Request $request, string $deliveryId, string $returnId): JsonResponse|DeliveryReturnResource
    {
        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $return = $this->returns->flagDiscrepancy(
                $this->findReturn($deliveryId, $returnId),
                $validated['notes'] ?? null,
            );
        } catch (DeliveryException $e) {
            return $this->unprocessable($e);
        }

        return new DeliveryReturnResource($return->load('lines'));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function delivery(string $deliveryId): Delivery
    {
        return $this->deliveries->findByUuidOrFail($deliveryId);
    }

    private function findReturn(string $deliveryId, string $returnId): DeliveryReturn
    {
        return DeliveryReturn::query()
            ->where('uuid', $returnId)
            ->whereHas('delivery', fn ($q) => $q->where('uuid', $deliveryId))
            ->firstOrFail();
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
