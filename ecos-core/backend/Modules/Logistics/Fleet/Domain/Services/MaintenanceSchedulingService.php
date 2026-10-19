<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Fleet\Domain\Enums\CostType;
use Modules\Logistics\Fleet\Domain\Enums\MaintenanceTrigger;
use Modules\Logistics\Fleet\Domain\Enums\OdometerSource;
use Modules\Logistics\Fleet\Domain\Enums\WorkOrderStatus;
use Modules\Logistics\Fleet\Domain\Events\MaintenanceCompleted;
use Modules\Logistics\Fleet\Domain\Events\MaintenanceDue;
use Modules\Logistics\Fleet\Domain\Events\MaintenanceOverdue;
use Modules\Logistics\Fleet\Domain\Events\MaintenanceScheduled;
use Modules\Logistics\Fleet\Domain\Exceptions\FleetException;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;
use Modules\Logistics\Fleet\Domain\Models\MaintenancePlan;
use Modules\Logistics\Fleet\Domain\Models\MaintenanceScheduleRule;
use Modules\Logistics\Fleet\Domain\Models\WorkOrder;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleStatus;
use Modules\Logistics\Vehicles\Domain\Services\VehicleMaintenanceService;
use Modules\Logistics\Vehicles\Domain\Services\VehicleService;

/**
 * Plans (what is due) and work orders (doing it).
 *
 * ┌─ ONE WRITER PER TABLE ──────────────────────────────────────────────────┐
 * │ Completing a work order calls LOG-003's VehicleMaintenanceService to     │
 * │ write logistics_vehicle_maintenance_records. Fleet NEVER inserts into    │
 * │ that table. The returned record id is stored on the work order as the    │
 * │ receipt, which makes the boundary auditable in the data.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class MaintenanceSchedulingService
{
    /** Seeded on registration so a new unit is never left with an empty plan set. */
    private const DEFAULT_PLANS = [
        ['type' => 'routine_service', 'name' => 'Routine service', 'km' => 10000, 'days' => 180, 'grace_days' => 14, 'grace_km' => 500],
        ['type' => 'oil_change', 'name' => 'Oil change', 'km' => 5000, 'days' => 90, 'grace_days' => 7, 'grace_km' => 300],
        ['type' => 'tyre_check', 'name' => 'Tyre inspection', 'km' => 15000, 'days' => 180, 'grace_days' => 14, 'grace_km' => 750],
    ];

    public function __construct(
        private readonly OdometerService $odometer,
        private readonly VehicleMaintenanceService $v1Maintenance,
        private readonly VehicleService $v1Vehicles,
    ) {}

    // ── Plans ─────────────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $attributes
     * @param  list<array{trigger: string, interval_value: float}>  $rules
     */
    public function createPlan(FleetUnit $unit, array $attributes, array $rules): MaintenancePlan
    {
        if ($rules === []) {
            throw FleetException::planNeedsAtLeastOneRule();
        }

        // Directive 5 / D3: telemetry is optional and deferred, so a plan that
        // could only ever be evaluated with engine hours is invalid. Rejecting
        // at configuration time is far kinder than a plan that silently never
        // comes due.
        $hasEvaluableRule = collect($rules)->contains(
            static fn (array $rule) => ! MaintenanceTrigger::from($rule['trigger'])->requiresTelemetry()
        );

        if (! $hasEvaluableRule) {
            throw FleetException::planNeedsNonTelemetryTrigger();
        }

        return DB::transaction(function () use ($unit, $attributes, $rules) {
            $plan = $unit->maintenancePlans()->create($attributes + [
                'company_id' => $unit->company_id,
            ]);

            foreach ($rules as $rule) {
                $plan->rules()->create([
                    'trigger' => $rule['trigger'],
                    'interval_value' => $rule['interval_value'],
                ]);
            }

            return $this->projectNextDue($plan->refresh());
        });
    }

    /** Seed sensible defaults so a freshly registered unit is immediately useful. */
    public function seedDefaultPlans(FleetUnit $unit): void
    {
        foreach (self::DEFAULT_PLANS as $spec) {
            $exists = $unit->maintenancePlans()
                ->where('maintenance_type', $spec['type'])
                ->whereNotNull('active_flag')
                ->exists();

            if ($exists) {
                continue;
            }

            $this->createPlan(
                $unit,
                [
                    'maintenance_type' => $spec['type'],
                    'name' => $spec['name'],
                    'grace_days' => $spec['grace_days'],
                    'grace_km' => $spec['grace_km'],
                ],
                [
                    ['trigger' => MaintenanceTrigger::Distance->value, 'interval_value' => $spec['km']],
                    ['trigger' => MaintenanceTrigger::Time->value, 'interval_value' => $spec['days']],
                ],
            );
        }
    }

    /**
     * Recompute next-due from the last completion plus each rule's interval.
     *
     * With no completion on record, the baseline is the unit's current odometer
     * and today — so a plan on a used vehicle comes due one interval from now
     * rather than immediately.
     */
    public function projectNextDue(MaintenancePlan $plan): MaintenancePlan
    {
        $plan->loadMissing(['rules', 'unit']);

        $unit = $plan->unit;
        $baselineKm = $plan->last_performed_km !== null
            ? (float) $plan->last_performed_km
            : ($unit !== null ? $this->odometer->currentKm($unit) : null);

        $baselineDate = $plan->last_performed_date ?? Carbon::today();

        $nextKm = null;
        $nextDate = null;

        foreach ($plan->rules->where('is_active', true) as $rule) {
            if ($rule->trigger === MaintenanceTrigger::Distance && $baselineKm !== null) {
                $nextKm = $baselineKm + (float) $rule->interval_value;
            }

            if ($rule->trigger === MaintenanceTrigger::Time) {
                $nextDate = Carbon::parse($baselineDate)->addDays((int) $rule->interval_value);
            }
        }

        $plan->update([
            'next_due_km' => $nextKm,
            'next_due_date' => $nextDate?->toDateString(),
        ]);

        return $plan->refresh();
    }

    /**
     * Evaluate every active plan on a unit and publish due / overdue facts.
     *
     * @return array{due: list<MaintenancePlan>, overdue: list<MaintenancePlan>}
     */
    public function evaluate(FleetUnit $unit, ?Carbon $at = null): array
    {
        $at ??= Carbon::today();
        $currentKm = $this->odometer->currentKm($unit);

        $due = [];
        $overdue = [];

        foreach ($unit->maintenancePlans()->where('is_active', true)->get() as $plan) {
            if ($plan->isOverdue($currentKm, $at)) {
                $overdue[] = $plan;
                MaintenanceOverdue::dispatch($plan);

                continue;
            }

            if ($plan->isDue($currentKm, $at)) {
                $due[] = $plan;
                MaintenanceDue::dispatch($plan);
            }
        }

        return ['due' => $due, 'overdue' => $overdue];
    }

    // ── Work orders ───────────────────────────────────────────────────────────

    /** @param array<string, mixed> $attributes */
    public function openWorkOrder(
        FleetUnit $unit,
        array $attributes,
        ?MaintenancePlan $plan = null,
        ?int $actorId = null,
    ): WorkOrder {
        return DB::transaction(fn () => $unit->workOrders()->create($attributes + [
            'company_id' => $unit->company_id,
            'maintenance_plan_id' => $plan?->id,
            'maintenance_type' => $plan?->maintenance_type ?? ($attributes['maintenance_type'] ?? 'other'),
            'status' => WorkOrderStatus::Planned->value,
            'created_by' => $actorId,
        ]));
    }

    public function schedule(WorkOrder $order, string $scheduledFor, ?string $vendor = null): WorkOrder
    {
        $this->assertTransition($order, WorkOrderStatus::Scheduled);

        $order->update([
            'status' => WorkOrderStatus::Scheduled->value,
            'scheduled_for' => $scheduledFor,
            'vendor' => $vendor ?? $order->vendor,
        ]);

        MaintenanceScheduled::dispatch($order->refresh());

        return $order->refresh();
    }

    /**
     * Begin the work. An odometer reading is mandatory — without it the job's
     * distance, and therefore repeat-repair analysis, is unrecoverable.
     */
    public function start(WorkOrder $order, float $odometerKm, ?int $actorId = null): WorkOrder
    {
        $this->assertTransition($order, WorkOrderStatus::InProgress);

        $unit = $order->unit;

        return DB::transaction(function () use ($order, $unit, $odometerKm, $actorId) {
            $this->odometer->record(
                $unit,
                $odometerKm,
                OdometerSource::Maintenance,
                sourceReference: $order->uuid,
                actorId: $actorId,
            );

            $order->update([
                'status' => WorkOrderStatus::InProgress->value,
                'started_at' => now(),
                'odometer_at_start_km' => $odometerKm,
            ]);

            // Immobilising work takes the vehicle off the road. LOG-003 owns
            // VehicleStatus, so we ask its service rather than writing it.
            if ($order->is_immobilising && $unit->vehicle !== null) {
                $this->v1Vehicles->changeStatus(
                    $unit->vehicle,
                    VehicleStatus::Maintenance,
                    'Fleet work order '.$order->uuid,
                );
            }

            return $order->refresh();
        });
    }

    /**
     * Complete the work and write the V1 maintenance record.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function complete(WorkOrder $order, array $attributes, ?int $actorId = null): WorkOrder
    {
        $this->assertTransition($order, WorkOrderStatus::Completed);

        $missing = [];
        if (! isset($attributes['cost'])) {
            $missing[] = 'cost';
        }
        if (! isset($attributes['odometer_km'])) {
            $missing[] = 'odometer reading';
        }
        if (empty($attributes['description']) && empty($order->description)) {
            $missing[] = 'description';
        }

        if ($missing !== []) {
            throw FleetException::workOrderCompletionIncomplete($missing);
        }

        $unit = $order->unit;
        $odometerKm = (float) $attributes['odometer_km'];
        $description = $attributes['description'] ?? $order->description;

        $completed = DB::transaction(function () use (
            $order, $unit, $attributes, $odometerKm, $description, $actorId
        ) {
            $this->odometer->record(
                $unit,
                $odometerKm,
                OdometerSource::Maintenance,
                sourceReference: $order->uuid,
                actorId: $actorId,
            );

            // ── The V1 boundary crossing ──────────────────────────────────
            // LOG-003 owns logistics_vehicle_maintenance_records. We call its
            // service and keep the receipt.
            $v1RecordId = null;
            if ($unit->vehicle !== null) {
                $record = $this->v1Maintenance->record($unit->vehicle, [
                    'performed_on' => now()->toDateString(),
                    'type' => $order->maintenance_type,
                    'description' => $description,
                    'cost' => $attributes['cost'],
                    'currency' => $attributes['currency'] ?? 'EGP',
                    'vendor' => $order->vendor,
                ]);

                $v1RecordId = $record->id;
            }

            $order->update([
                'status' => WorkOrderStatus::Completed->value,
                'completed_at' => now(),
                'completed_by' => $actorId,
                'odometer_at_completion_km' => $odometerKm,
                'cost' => $attributes['cost'],
                'currency' => $attributes['currency'] ?? 'EGP',
                'description' => $description,
                'v1_maintenance_record_id' => $v1RecordId,
            ]);

            // Advance the plan: the work resets the interval.
            if ($order->plan !== null) {
                $order->plan->update([
                    'last_performed_km' => $odometerKm,
                    'last_performed_date' => now()->toDateString(),
                ]);
                $this->projectNextDue($order->plan->refresh());
            }

            // Bring the vehicle back if this job took it off the road.
            if ($order->is_immobilising
                && $unit->vehicle !== null
                && $unit->vehicle->status === VehicleStatus::Maintenance) {
                $this->v1Vehicles->changeStatus(
                    $unit->vehicle->refresh(),
                    VehicleStatus::Available,
                    'Work order '.$order->uuid.' completed',
                );
            }

            return $order->refresh();
        });

        MaintenanceCompleted::dispatch($completed);

        return $completed;
    }

    public function cancel(WorkOrder $order, string $reason): WorkOrder
    {
        $this->assertTransition($order, WorkOrderStatus::Cancelled);

        $order->update([
            'status' => WorkOrderStatus::Cancelled->value,
            'cancellation_reason' => $reason,
        ]);

        return $order->refresh();
    }

    /** The cost type a completed work order posts. */
    public function costTypeFor(WorkOrder $order): CostType
    {
        return CostType::Maintenance;
    }

    private function assertTransition(WorkOrder $order, WorkOrderStatus $target): void
    {
        if (! $order->status->canTransitionTo($target)) {
            throw FleetException::invalidWorkOrderTransition($order->status, $target);
        }
    }
}
