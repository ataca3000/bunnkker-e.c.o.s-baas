<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Logistics\Distribution\Domain\Enums\CustodyItemType;
use Modules\Logistics\Distribution\Domain\Enums\TripStatus;
use Modules\Logistics\Distribution\Domain\Enums\TripType;
use Modules\Logistics\Distribution\Domain\Exceptions\DistributionException;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Distribution\Domain\Services\TripService;
use Modules\Logistics\Distribution\Presentation\Http\Resources\TripCustodyResource;
use Modules\Logistics\Distribution\Presentation\Http\Resources\TripOrderResource;
use Modules\Logistics\Distribution\Presentation\Http\Resources\TripResource;

class TripController extends Controller
{
    public function __construct(
        private readonly TripService $trips,
    ) {}

    // ── Reference data ───────────────────────────────────────────────────────

    public function options(): JsonResponse
    {
        return response()->json([
            'statuses' => TripStatus::options(),
            'types' => TripType::options(),
            'custody_item_types' => CustodyItemType::options(),
        ]);
    }

    public function stats(Request $request): JsonResponse
    {
        $base = fn () => Trip::query()
            ->when($request->filled('company_id'), fn ($q) => $q->where('company_id', $request->input('company_id')));

        $byStatus = $base()->selectRaw('status, COUNT(*) AS total')->groupBy('status')->pluck('total', 'status');
        $count = static fn (TripStatus $s): int => (int) ($byStatus[$s->value] ?? 0);

        return response()->json([
            'total_trips' => (int) $byStatus->sum(),
            'planning' => $count(TripStatus::Planning),
            'loading' => $count(TripStatus::Loading),
            'ready_for_dispatch' => $count(TripStatus::ReadyForDispatch),
            'dispatch_blocked' => $count(TripStatus::DispatchBlocked),
            'on_the_road' => $count(TripStatus::Dispatched)
                + $count(TripStatus::OutForDelivery)
                + $count(TripStatus::InProgress),
            'completed' => $count(TripStatus::Completed),
            'settlement_pending' => $count(TripStatus::SettlementPending),
            'closed' => $count(TripStatus::Closed),
            'cancelled' => $count(TripStatus::Cancelled),
        ]);
    }

    public function nextNumber(Request $request): JsonResponse
    {
        return response()->json([
            'trip_number' => $this->trips->nextTripNumber($request->input('company_id')),
        ]);
    }

    // ── Trips ────────────────────────────────────────────────────────────────

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Trip::query()
            ->withCount(['tripOrders', 'stops', 'custodyItems', 'exceptions'])
            ->with(['shippingCompany', 'driverVehicleAssignment.driver', 'driverVehicleAssignment.vehicle'])
            ->latest('id');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('trip_number', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
            });
        }

        $status = $request->input('status');
        if ($status && in_array($status, TripStatus::values(), true)) {
            $query->where('status', $status);
        } elseif ($status !== 'all') {
            $query->whereNotIn('status', [TripStatus::Closed->value, TripStatus::Cancelled->value]);
        }

        foreach (['company_id', 'preparation_wave_id', 'distribution_zone_id', 'shipping_company_id'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->input($filter));
            }
        }

        if ($request->filled('type') && in_array($request->input('type'), TripType::values(), true)) {
            $query->where('type', $request->input('type'));
        }

        $perPage = min((int) $request->input('per_page', 20), 100);

        return TripResource::collection($query->paginate($perPage));
    }

    public function show(string $id): TripResource
    {
        return new TripResource($this->loadTrip($id));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());
        $validated['created_by'] = $request->user()?->id;

        $trip = $this->trips->create($validated, $this->actor($request));

        return (new TripResource($this->loadTrip($trip->uuid)))->response()->setStatusCode(201);
    }

    public function update(Request $request, string $id): TripResource
    {
        $trip = $this->resolveTrip($id);
        $this->trips->update($trip, $request->validate($this->rules(partial: true)));

        return new TripResource($this->loadTrip($id));
    }

    public function setStatus(Request $request, string $id): JsonResponse|TripResource
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(TripStatus::values())],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $trip = $this->loadTrip($id);

        try {
            $this->trips->changeStatus(
                $trip,
                TripStatus::from($validated['status']),
                $validated['reason'] ?? null,
                $this->actor($request),
            );
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return new TripResource($this->loadTrip($id));
    }

    /** Read-only readiness probe used by the dispatch gate UI. */
    public function dispatchReadiness(string $id): JsonResponse
    {
        $trip = $this->loadTrip($id);
        $blockers = $trip->dispatchBlockers();

        return response()->json([
            'is_ready' => $blockers === [],
            'blockers' => $blockers,
            'has_full_driver_acceptance' => $trip->hasFullDriverAcceptance(),
        ]);
    }

    // ── Trip orders ──────────────────────────────────────────────────────────

    public function orders(string $id): AnonymousResourceCollection
    {
        return TripOrderResource::collection($this->resolveTrip($id)->tripOrders()->get());
    }

    public function addOrder(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'order_id' => ['required', 'uuid', 'exists:orders,id'],
            'zone_code' => ['nullable', 'string', 'max:30'],
            'governorate' => ['nullable', 'string', 'max:100'],
            'assignment_type' => ['sometimes', Rule::in(['auto', 'manual'])],
        ]);

        try {
            $tripOrder = $this->trips->assignOrder(
                $this->resolveTrip($id),
                $validated['order_id'],
                ['zone_code' => $validated['zone_code'] ?? null, 'governorate' => $validated['governorate'] ?? null],
                $request->user()?->id,
                $validated['assignment_type'] ?? 'auto',
            );
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return (new TripOrderResource($tripOrder))->response()->setStatusCode(201);
    }

    public function removeOrder(string $id, string $orderId): JsonResponse
    {
        try {
            $this->trips->removeOrder($this->resolveTrip($id), $orderId);
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(null, 204);
    }

    public function moveOrder(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'order_id' => ['required', 'uuid'],
            'target_trip_id' => ['required', 'uuid', 'exists:distribution_trips,uuid'],
        ]);

        try {
            $moved = $this->trips->moveOrder(
                $this->resolveTrip($id),
                $this->resolveTrip($validated['target_trip_id']),
                $validated['order_id'],
                $request->user()?->id,
            );
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return (new TripOrderResource($moved))->response()->setStatusCode(201);
    }

    // ── Custody ──────────────────────────────────────────────────────────────

    public function custody(string $id): AnonymousResourceCollection
    {
        return TripCustodyResource::collection($this->resolveTrip($id)->custodyItems()->get());
    }

    public function addCustody(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'item_type' => ['required', Rule::in(CustodyItemType::values())],
            'description' => ['nullable', 'string', 'max:200'],
            'quantity' => ['sometimes', 'integer', 'min:1', 'max:9999'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $item = $this->trips->addCustody($this->resolveTrip($id), $validated, $request->user()?->id);
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return (new TripCustodyResource($item))->response()->setStatusCode(201);
    }

    public function confirmCustody(Request $request, string $id, int $custodyId): TripCustodyResource
    {
        $validated = $request->validate([
            'received_quantity' => ['required', 'integer', 'min:0', 'max:9999'],
        ]);

        $item = $this->resolveTrip($id)->custodyItems()->findOrFail($custodyId);

        return new TripCustodyResource(
            $this->trips->confirmCustody($item, $validated['received_quantity'], $request->user()?->id)
        );
    }

    public function removeCustody(string $id, int $custodyId): JsonResponse
    {
        $trip = $this->resolveTrip($id);

        if (! $trip->isEditable()) {
            return response()->json([
                'message' => DistributionException::tripNotEditable($trip->status)->getMessage(),
            ], 422);
        }

        $trip->custodyItems()->findOrFail($custodyId)->delete();

        return response()->json(null, 204);
    }

    // ── Driver acceptance & resourcing ───────────────────────────────────────

    public function recordDriverAcceptance(Request $request, string $id): TripResource
    {
        $validated = $request->validate([
            'products' => ['required', 'boolean'],
            'custody' => ['required', 'boolean'],
            'equipment' => ['required', 'boolean'],
            'discrepancy_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->trips->recordDriverAcceptance(
            $this->loadTrip($id),
            $validated['products'],
            $validated['custody'],
            $validated['equipment'],
            $validated['discrepancy_notes'] ?? null,
            $request->user()?->id,
        );

        return new TripResource($this->loadTrip($id));
    }

    public function assignDriverVehicle(Request $request, string $id): JsonResponse|TripResource
    {
        $validated = $request->validate([
            'driver_vehicle_assignment_id' => [
                'required', 'integer', 'exists:logistics_driver_vehicle_assignments,id',
            ],
        ]);

        try {
            $this->trips->assignDriverVehicle($this->resolveTrip($id), $validated['driver_vehicle_assignment_id']);
        } catch (DistributionException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return new TripResource($this->loadTrip($id));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function loadTrip(string $id): Trip
    {
        return Trip::withCount(['tripOrders', 'stops', 'custodyItems', 'exceptions'])
            ->with([
                'shippingCompany',
                'driverVehicleAssignment.driver',
                'driverVehicleAssignment.vehicle.documents',
                'tripOrders',
                'custodyItems',
                'settlement',
            ])
            ->where('uuid', $id)
            ->firstOrFail();
    }

    /**
     * Resolve a trip by its public UUID identifier.
     */
    private function resolveTrip(string $id): Trip
    {
        return Trip::where('uuid', $id)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function rules(bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'company_id' => [$required, 'uuid', 'exists:companies,id'],
            'name' => [$required, 'string', 'max:150'],
            'trip_number' => ['sometimes', 'string', 'max:30'],
            'type' => ['sometimes', Rule::in(TripType::values())],
            'capacity' => ['sometimes', 'integer', 'min:1', 'max:9999'],
            'preparation_wave_id' => ['nullable', 'uuid', 'exists:preparation_waves,id'],
            'distribution_zone_id' => ['nullable', 'integer', 'exists:distribution_zones,id'],
            'shipping_company_id' => ['nullable', 'integer', 'exists:logistics_shipping_companies,id'],
            'driver_vehicle_assignment_id' => [
                'nullable', 'integer', 'exists:logistics_driver_vehicle_assignments,id',
            ],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    private function actor(Request $request): ?string
    {
        $user = $request->user();

        return $user?->name ?? $user?->email;
    }
}
