<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Logistics\Fleet\Domain\Contracts\FleetUnitRepositoryInterface;
use Modules\Logistics\Fleet\Domain\Enums\MaintenanceTrigger;
use Modules\Logistics\Fleet\Domain\Enums\WorkOrderStatus;
use Modules\Logistics\Fleet\Domain\Exceptions\FleetException;
use Modules\Logistics\Fleet\Domain\Models\MaintenancePlan;
use Modules\Logistics\Fleet\Domain\Models\WorkOrder;
use Modules\Logistics\Fleet\Domain\Services\MaintenanceSchedulingService;
use Modules\Logistics\Fleet\Presentation\Http\Resources\MaintenancePlanResource;
use Modules\Logistics\Fleet\Presentation\Http\Resources\WorkOrderResource;

/**
 * Maintenance plans (what is due) and work orders (doing it).
 *
 * Completing a work order writes the V1 maintenance record through LOG-003's
 * VehicleMaintenanceService — the response echoes the created record id as
 * proof the boundary was crossed correctly.
 */
class MaintenanceController extends Controller
{
    public function __construct(
        private readonly FleetUnitRepositoryInterface $units,
        private readonly MaintenanceSchedulingService $scheduling,
    ) {}

    // ── Plans ────────────────────────────────────────────────────────────────

    public function plans(string $unitId): AnonymousResourceCollection
    {
        $unit = $this->units->findByUuidOrFail($unitId);

        return MaintenancePlanResource::collection(
            $unit->maintenancePlans()->with(['rules', 'unit'])->get()
        );
    }

    public function storePlan(Request $request, string $unitId): JsonResponse
    {
        $validated = $request->validate([
            'maintenance_type' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'grace_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'grace_km' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'rules' => ['required', 'array', 'min:1'],
            'rules.*.trigger' => ['required', Rule::in(MaintenanceTrigger::values())],
            'rules.*.interval_value' => ['required', 'numeric', 'min:1'],
        ]);

        $unit = $this->units->findByUuidOrFail($unitId);
        $rules = $validated['rules'];
        unset($validated['rules']);

        try {
            $plan = $this->scheduling->createPlan(
                $unit,
                array_filter($validated, static fn ($v) => $v !== null),
                $rules,
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return (new MaintenancePlanResource($plan->load(['rules', 'unit'])))
            ->response()
            ->setStatusCode(201);
    }

    /** Re-project next-due after a manual correction to the baseline. */
    public function reprojectPlan(string $unitId, string $planId): MaintenancePlanResource
    {
        $plan = $this->plan($unitId, $planId);

        return new MaintenancePlanResource(
            $this->scheduling->projectNextDue($plan)->load(['rules', 'unit'])
        );
    }

    /** What is due or overdue on this unit right now. */
    public function evaluate(string $unitId): JsonResponse
    {
        $unit = $this->units->findByUuidOrFail($unitId);
        $result = $this->scheduling->evaluate($unit);

        return response()->json([
            'due' => MaintenancePlanResource::collection(collect($result['due']))->resolve(),
            'overdue' => MaintenancePlanResource::collection(collect($result['overdue']))->resolve(),
        ]);
    }

    // ── Work orders ──────────────────────────────────────────────────────────

    public function workOrders(Request $request): AnonymousResourceCollection
    {
        $query = WorkOrder::query()
            ->when($request->user()?->company_id, fn ($q, $companyId) => $q->where('company_id', $companyId))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when(
                $request->boolean('open_only'),
                fn ($q) => $q->whereNotIn('status', [
                    WorkOrderStatus::Completed->value,
                    WorkOrderStatus::Cancelled->value,
                ]),
            )
            ->latest('id');

        return WorkOrderResource::collection($query->paginate(
            max(1, min((int) $request->integer('per_page', 20), 100))
        ));
    }

    public function storeWorkOrder(Request $request, string $unitId): JsonResponse
    {
        $validated = $request->validate([
            'maintenance_plan_id' => ['nullable', 'integer', 'exists:fleet_maintenance_plans,id'],
            'maintenance_type' => ['required_without:maintenance_plan_id', 'string', 'max:40'],
            'kind' => ['nullable', Rule::in([
                WorkOrder::KIND_PREVENTIVE,
                WorkOrder::KIND_CORRECTIVE,
                WorkOrder::KIND_STATUTORY,
            ])],
            'description' => ['nullable', 'string', 'max:2000'],
            'vendor' => ['nullable', 'string', 'max:150'],
            'is_immobilising' => ['nullable', 'boolean'],
        ]);

        $unit = $this->units->findByUuidOrFail($unitId);
        $plan = isset($validated['maintenance_plan_id'])
            ? MaintenancePlan::findOrFail($validated['maintenance_plan_id'])
            : null;
        unset($validated['maintenance_plan_id']);

        $order = $this->scheduling->openWorkOrder(
            $unit,
            array_filter($validated, static fn ($v) => $v !== null),
            $plan,
            $request->user()?->id,
        );

        return (new WorkOrderResource($order))->response()->setStatusCode(201);
    }

    public function scheduleWorkOrder(Request $request, string $id): JsonResponse|WorkOrderResource
    {
        $validated = $request->validate([
            'scheduled_for' => ['required', 'date'],
            'vendor' => ['nullable', 'string', 'max:150'],
        ]);

        try {
            $order = $this->scheduling->schedule(
                $this->workOrder($id),
                $validated['scheduled_for'],
                $validated['vendor'] ?? null,
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new WorkOrderResource($order);
    }

    public function startWorkOrder(Request $request, string $id): JsonResponse|WorkOrderResource
    {
        $validated = $request->validate([
            'odometer_km' => ['required', 'numeric', 'min:0'],
        ]);

        try {
            $order = $this->scheduling->start(
                $this->workOrder($id),
                (float) $validated['odometer_km'],
                $request->user()?->id,
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new WorkOrderResource($order);
    }

    /**
     * Complete the work. This is the endpoint that writes the V1 record — the
     * response carries v1_maintenance_record_id as the receipt.
     */
    public function completeWorkOrder(Request $request, string $id): JsonResponse|WorkOrderResource
    {
        $validated = $request->validate([
            'odometer_km' => ['required', 'numeric', 'min:0'],
            'cost' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $order = $this->scheduling->complete(
                $this->workOrder($id),
                $validated,
                $request->user()?->id,
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new WorkOrderResource($order);
    }

    public function cancelWorkOrder(Request $request, string $id): JsonResponse|WorkOrderResource
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        try {
            $order = $this->scheduling->cancel($this->workOrder($id), $validated['reason']);
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new WorkOrderResource($order);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function plan(string $unitId, string $planId): MaintenancePlan
    {
        return MaintenancePlan::query()
            ->where('uuid', $planId)
            ->whereHas('unit', fn ($q) => $q->where('uuid', $unitId))
            ->firstOrFail();
    }

    private function workOrder(string $id): WorkOrder
    {
        return WorkOrder::query()->where('uuid', $id)->firstOrFail();
    }

    private function unprocessable(FleetException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage()], 422);
    }
}
