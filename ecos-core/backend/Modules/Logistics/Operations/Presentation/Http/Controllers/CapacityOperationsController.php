<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Modules\Logistics\Network\Domain\Enums\CapacityUnit;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;
use Modules\Logistics\Operations\Domain\Enums\ReservationStatus;
use Modules\Logistics\Operations\Domain\Models\CapacityReservation;
use Modules\Logistics\Operations\Domain\Models\ResourcePool;
use Modules\Logistics\Operations\Domain\Services\CapacityMonitoringService;
use Modules\Logistics\Operations\Domain\Services\CapacityRebalancingService;
use Modules\Logistics\Operations\Domain\Services\CapacityReservationService;
use Modules\Logistics\Operations\Domain\Services\ReservationAuditService;
use Modules\Logistics\Operations\Presentation\Http\Resources\CapacityReservationResource;

/**
 * The reservation lifecycle, rebalancing and the audit trail.
 *
 * Nothing here computes capacity. Every decision is CapacityLedgerService's, and
 * when it refuses the reason reaches the client in Network's own words.
 */
class CapacityOperationsController extends Controller
{
    public function __construct(
        private readonly CapacityReservationService $reservations,
        private readonly CapacityRebalancingService $rebalancing,
        private readonly CapacityMonitoringService $monitoring,
        private readonly ReservationAuditService $audit,
    ) {}

    public function options(): JsonResponse
    {
        return response()->json([
            'reservation_statuses' => ReservationStatus::options(),
            'capacity_units' => array_map(
                static fn (CapacityUnit $u) => ['value' => $u->value, 'label' => $u->label()],
                CapacityUnit::cases(),
            ),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = CapacityReservation::query()
            ->when($this->companyId($request), fn ($q, $id) => $q->where('company_id', $id))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when(
                $request->boolean('holding_only'),
                fn ($q) => $q->whereIn('status', [
                    ReservationStatus::Held->value,
                    ReservationStatus::Confirmed->value,
                ]),
            )
            ->with(['slot', 'commitment', 'pool'])
            ->latest('requested_at');

        return CapacityReservationResource::collection(
            $query->paginate(max(1, min((int) $request->integer('per_page', 20), 100)))
        )->response();
    }

    public function show(string $id): CapacityReservationResource
    {
        return new CapacityReservationResource(
            $this->reservation($id)->load(['slot', 'commitment', 'pool'])
        );
    }

    /**
     * Ask the ledger for a hold.
     *
     * A refusal is a 422 carrying Network's reason — and it also leaves a Failed
     * reservation behind, so the evidence that the ask was made and turned down
     * survives past the browser.
     */
    public function reserve(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'capacity_slot_id' => ['required', 'string'],
            'orders' => ['nullable', 'numeric', 'min:0'],
            'stops' => ['nullable', 'numeric', 'min:0'],
            'weight_kg' => ['nullable', 'numeric', 'min:0'],
            'volume_m3' => ['nullable', 'numeric', 'min:0'],
            'resource_pool_id' => ['nullable', 'string'],
            'reference_type' => ['nullable', 'string', 'max:40'],
            'reference_id' => ['nullable', 'string', 'max:64'],
            'purpose' => ['nullable', 'string', 'max:500'],
            'ttl_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
        ]);

        $pool = isset($validated['resource_pool_id'])
            ? ResourcePool::query()->where('uuid', $validated['resource_pool_id'])->first()
            : null;

        $reservation = $this->reservations->request(
            $this->slot($validated['capacity_slot_id']),
            [
                CapacityUnit::Orders->value => (float) ($validated['orders'] ?? 0),
                CapacityUnit::Stops->value => (float) ($validated['stops'] ?? 0),
                CapacityUnit::WeightKg->value => (float) ($validated['weight_kg'] ?? 0),
                CapacityUnit::VolumeM3->value => (float) ($validated['volume_m3'] ?? 0),
            ],
            $pool,
            $validated['reference_type'] ?? null,
            $validated['reference_id'] ?? null,
            $validated['purpose'] ?? null,
            isset($validated['ttl_minutes']) ? (int) $validated['ttl_minutes'] : null,
            $request->user()?->id,
            $request->user()?->name,
        );

        return (new CapacityReservationResource($reservation->load(['slot', 'commitment', 'pool'])))
            ->response()
            ->setStatusCode(201);
    }

    public function confirm(Request $request, string $id): CapacityReservationResource
    {
        $reservation = $this->reservations->confirm(
            $this->reservation($id),
            $request->user()?->id,
            $request->user()?->name,
        );

        return new CapacityReservationResource($reservation->load(['slot', 'commitment', 'pool']));
    }

    public function release(Request $request, string $id): CapacityReservationResource
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $reservation = $this->reservations->release(
            $this->reservation($id),
            $validated['reason'] ?? null,
            $request->user()?->id,
            $request->user()?->name,
        );

        return new CapacityReservationResource($reservation->load(['slot', 'commitment', 'pool']));
    }

    // ── Rebalancing ──────────────────────────────────────────────────────────

    /** Advisory. Nothing is held, so two operators may see the same candidate. */
    public function rebalanceCandidates(Request $request, string $id): JsonResponse
    {
        return response()->json([
            'data' => $this->rebalancing->candidatesFor(
                $this->reservation($id),
                (int) $request->integer('limit', 5),
            ),
        ]);
    }

    public function rebalance(Request $request, string $id): CapacityReservationResource
    {
        $validated = $request->validate([
            'destination_slot_id' => ['required', 'string'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $reservation = $this->rebalancing->rebalance(
            $this->reservation($id),
            $this->slot($validated['destination_slot_id']),
            $validated['reason'] ?? null,
            $request->user()?->id,
            $request->user()?->name,
        );

        return new CapacityReservationResource($reservation->load(['slot', 'commitment', 'pool']));
    }

    /** Bring the operational record into line with the ledger's own sweep. */
    public function reconcile(): JsonResponse
    {
        return response()->json([
            'holds_reclaimed' => $this->reservations->reconcileExpired(),
        ]);
    }

    // ── Monitoring and audit ─────────────────────────────────────────────────

    public function monitoring(Request $request): JsonResponse
    {
        $request->validate(['date' => ['nullable', 'date']]);

        $companyId = $this->companyId($request);

        return response()->json([
            'data' => [
                'slots' => $this->monitoring->overview(
                    $companyId,
                    $request->filled('date') ? Carbon::parse($request->string('date')) : null,
                ),
                'reservations' => $this->monitoring->reservationStatistics($companyId),
                'refusal_reasons' => $this->monitoring->refusalReasons($companyId),
            ],
        ]);
    }

    public function auditTrail(string $id): JsonResponse
    {
        $entries = $this->audit->forReservation($this->reservation($id));

        return response()->json([
            'data' => array_map(static fn ($entry) => [
                'id' => $entry->uuid,
                'action' => $entry->action,
                'outcome' => $entry->outcome,
                'reason' => $entry->reason,
                'context' => $entry->context ?? [],
                'performed_at' => $entry->performed_at?->toIso8601String(),
                'actor_name' => $entry->actor_name,
            ], $entries),
        ]);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function reservation(string $id): CapacityReservation
    {
        return CapacityReservation::query()->where('uuid', $id)->firstOrFail();
    }

    private function slot(string $id): CapacitySlot
    {
        return CapacitySlot::query()->where('uuid', $id)->with('plan')->firstOrFail();
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
