<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Logistics\Fleet\Domain\Contracts\FleetUnitRepositoryInterface;
use Modules\Logistics\Fleet\Domain\Enums\CostType;
use Modules\Logistics\Fleet\Domain\Enums\DefectSeverity;
use Modules\Logistics\Fleet\Domain\Enums\DefectStatus;
use Modules\Logistics\Fleet\Domain\Enums\FitnessLevel;
use Modules\Logistics\Fleet\Domain\Enums\FleetUnitLifecycle;
use Modules\Logistics\Fleet\Domain\Enums\FuelTransactionStatus;
use Modules\Logistics\Fleet\Domain\Enums\InspectionKind;
use Modules\Logistics\Fleet\Domain\Enums\InspectionStatus;
use Modules\Logistics\Fleet\Domain\Enums\MaintenanceTrigger;
use Modules\Logistics\Fleet\Domain\Enums\OdometerSource;
use Modules\Logistics\Fleet\Domain\Enums\WorkOrderStatus;
use Modules\Logistics\Fleet\Domain\Exceptions\FleetException;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;
use Modules\Logistics\Fleet\Domain\Services\FleetReadinessService;
use Modules\Logistics\Fleet\Domain\Services\FleetUnitService;
use Modules\Logistics\Fleet\Domain\Services\OdometerService;
use Modules\Logistics\Fleet\Domain\Services\VehicleCostService;
use Modules\Logistics\Fleet\Presentation\Http\Resources\FleetUnitResource;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;

/**
 * Fleet units — registration, lifecycle, fitness and cost.
 *
 * Directive 3: nothing here imports Distribution or Delivery. Fitness is
 * computable with both uninstalled.
 */
class FleetUnitController extends Controller
{
    public function __construct(
        private readonly FleetUnitRepositoryInterface $units,
        private readonly FleetUnitService $service,
        private readonly FleetReadinessService $readiness,
        private readonly OdometerService $odometer,
        private readonly VehicleCostService $costs,
    ) {}

    /** Everything the UI needs for filters and dropdowns, in one cached call. */
    public function options(): JsonResponse
    {
        return response()->json([
            'lifecycle_states' => FleetUnitLifecycle::options(),
            'fitness_levels' => FitnessLevel::options(),
            'work_order_statuses' => WorkOrderStatus::options(),
            'inspection_statuses' => InspectionStatus::options(),
            'inspection_kinds' => InspectionKind::options(),
            'defect_statuses' => DefectStatus::options(),
            'defect_severities' => DefectSeverity::options(),
            'fuel_statuses' => FuelTransactionStatus::options(),
            'maintenance_triggers' => MaintenanceTrigger::options(),
            'odometer_sources' => OdometerSource::options(),
            'cost_types' => CostType::options(),
        ]);
    }

    public function stats(Request $request): JsonResponse
    {
        return response()->json(
            $this->units->statistics($this->companyId($request))
        );
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only([
            'lifecycle_state', 'fleet_group_id', 'vehicle_id',
            'has_critical_defect', 'has_open_work_order',
        ]);
        $filters['company_id'] = $this->companyId($request);

        $perPage = (int) $request->integer('per_page', 20);
        $page = $this->units->paginate($filters, max(1, min($perPage, 100)));

        return FleetUnitResource::collection($page)->response();
    }

    public function show(string $id): FleetUnitResource
    {
        return new FleetUnitResource($this->units->findByUuidOrFail($id));
    }

    /**
     * Register the operational shadow of an existing V1 vehicle.
     *
     * Directive 2: takes a vehicle id, copies no vehicle attribute.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'vehicle_id' => ['required', 'integer', 'exists:logistics_vehicles,id'],
            'fleet_group_id' => ['nullable', 'integer', 'exists:fleet_groups,id'],
            'acquisition_cost' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'acquisition_date' => ['nullable', 'date'],
            'useful_life_months' => ['nullable', 'integer', 'min:1', 'max:600'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $vehicle = Vehicle::findOrFail($validated['vehicle_id']);
        unset($validated['vehicle_id']);
        $validated['created_by'] = $request->user()?->id;

        try {
            $unit = $this->service->register(
                $vehicle,
                array_filter($validated, static fn ($v) => $v !== null),
                $this->actor($request),
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return (new FleetUnitResource($unit->load(['vehicle', 'maintenancePlans.rules'])))
            ->response()
            ->setStatusCode(201);
    }

    public function setLifecycle(Request $request, string $id): JsonResponse|FleetUnitResource
    {
        $validated = $request->validate([
            'lifecycle_state' => ['required', Rule::in(FleetUnitLifecycle::values())],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $unit = $this->units->findByUuidOrFail($id);

        try {
            $updated = $this->service->changeLifecycle(
                $unit,
                FleetUnitLifecycle::from($validated['lifecycle_state']),
                $validated['reason'] ?? null,
                $this->actor($request),
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new FleetUnitResource($updated->load('vehicle'));
    }

    public function moveGroup(Request $request, string $id): JsonResponse|FleetUnitResource
    {
        $validated = $request->validate([
            'fleet_group_id' => ['required', 'integer', 'exists:fleet_groups,id'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $unit = $this->units->findByUuidOrFail($id);
        $group = \Modules\Logistics\Fleet\Domain\Models\FleetGroup::findOrFail($validated['fleet_group_id']);

        $updated = $this->service->moveToGroup(
            $unit,
            $group,
            $validated['reason'] ?? null,
            $request->user()?->id,
        );

        return new FleetUnitResource($updated->load(['vehicle', 'group.fleet']));
    }

    /**
     * The readiness answer, with its ordered blockers.
     *
     * This is what Dispatch consumes (Phase 4). Delivery and Distribution do
     * not — they keep using LOG-003's Vehicle::canBeDispatched(), which D2
     * leaves unmodified.
     */
    public function fitness(string $id): JsonResponse
    {
        $unit = $this->units->findByUuidOrFail($id);

        return response()->json([
            'data' => $this->readiness->verdict($unit)->toArray(),
        ]);
    }

    public function health(string $id): JsonResponse
    {
        $unit = $this->units->findByUuidOrFail($id);

        return response()->json([
            'data' => $this->readiness->healthScore($unit)->toArray(),
        ]);
    }

    // ── Odometer ─────────────────────────────────────────────────────────────

    /**
     * Record a reading. A rollback is recorded but NOT accepted — the response
     * says which happened rather than silently discarding the reading.
     */
    public function recordOdometer(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reading_km' => ['required', 'numeric', 'min:0'],
            'source' => ['nullable', Rule::in(OdometerSource::values())],
            'recorded_at' => ['nullable', 'date'],
        ]);

        $unit = $this->units->findByUuidOrFail($id);

        $reading = $this->odometer->record(
            $unit,
            (float) $validated['reading_km'],
            OdometerSource::from($validated['source'] ?? OdometerSource::Manual->value),
            isset($validated['recorded_at']) ? \Illuminate\Support\Carbon::parse($validated['recorded_at']) : null,
            actorId: $request->user()?->id,
        );

        return response()->json([
            'data' => [
                'id' => $reading->id,
                'reading_km' => (float) $reading->reading_km,
                'source' => $reading->source->value,
                'is_accepted' => $reading->is_accepted,
                'rejection_reason' => $reading->rejection_reason,
                'current_odometer_km' => $this->odometer->currentKm($unit->refresh()),
                'recorded_at' => $reading->recorded_at?->toIso8601String(),
            ],
        ]);
    }

    public function odometerHistory(Request $request, string $id): JsonResponse
    {
        $unit = $this->units->findByUuidOrFail($id);

        $readings = $unit->odometerReadings()
            ->limit((int) $request->integer('limit', 50))
            ->get()
            ->map(static fn ($reading) => [
                'id' => $reading->id,
                'reading_km' => (float) $reading->reading_km,
                'source' => $reading->source->value,
                'source_label' => $reading->source->label(),
                'is_accepted' => $reading->is_accepted,
                'rejection_reason' => $reading->rejection_reason,
                'source_reference' => $reading->source_reference,
                'recorded_at' => $reading->recorded_at?->toIso8601String(),
            ]);

        return response()->json([
            'data' => $readings,
            'meta' => [
                'current_odometer_km' => $this->odometer->currentKm($unit),
                'is_stale' => $this->odometer->isStale($unit),
            ],
        ]);
    }

    // ── Cost ─────────────────────────────────────────────────────────────────

    public function costs(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $unit = $this->units->findByUuidOrFail($id);

        $from = isset($validated['from'])
            ? \Illuminate\Support\Carbon::parse($validated['from'])
            : \Illuminate\Support\Carbon::today()->subMonths(3);
        $to = isset($validated['to'])
            ? \Illuminate\Support\Carbon::parse($validated['to'])
            : \Illuminate\Support\Carbon::today();

        return response()->json([
            'data' => $this->costs->summary($unit, $from, $to),
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function unprocessable(FleetException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage()], 422);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }

    private function actor(Request $request): ?string
    {
        return $request->user()?->name;
    }

    /** @return FleetUnit */
    protected function resolve(string $id): FleetUnit
    {
        return $this->units->findByUuidOrFail($id);
    }
}
