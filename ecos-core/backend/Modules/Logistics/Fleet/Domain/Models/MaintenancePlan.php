<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Logistics\Fleet\Domain\Enums\MaintenanceTrigger;

/**
 * What is DUE. The forward-looking half LOG-003 deliberately did not model.
 *
 * Due-ness is computed from whichever rule fires first. Grace converts "due"
 * into a warning; past grace it becomes a hard fitness blocker.
 */
class MaintenancePlan extends Model
{
    protected $table = 'fleet_maintenance_plans';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_active' => true,
        'active_flag' => 1,
        'grace_days' => 0,
        'grace_km' => 0,
    ];

    protected $fillable = [
        'uuid', 'fleet_unit_id', 'company_id',
        'maintenance_type', 'name', 'description',
        'next_due_km', 'next_due_date', 'last_performed_km', 'last_performed_date',
        'grace_days', 'grace_km', 'is_active', 'active_flag', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'next_due_km' => 'decimal:1',
            'last_performed_km' => 'decimal:1',
            'next_due_date' => 'date:Y-m-d',
            'last_performed_date' => 'date:Y-m-d',
            'grace_days' => 'integer',
            'grace_km' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $plan): void {
            if ($plan->uuid === null) {
                $plan->uuid = (string) Str::uuid();
            }
        });
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(FleetUnit::class, 'fleet_unit_id');
    }

    public function rules(): HasMany
    {
        return $this->hasMany(MaintenanceScheduleRule::class, 'maintenance_plan_id');
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class, 'maintenance_plan_id')->latest('id');
    }

    // ── Due-ness ──────────────────────────────────────────────────────────────

    public function isDueByDate(?Carbon $at = null): bool
    {
        if ($this->next_due_date === null) {
            return false;
        }

        return ($at ?? Carbon::today())->gte($this->next_due_date);
    }

    public function isDueByDistance(?float $currentKm): bool
    {
        if ($this->next_due_km === null || $currentKm === null) {
            return false;
        }

        return $currentKm >= (float) $this->next_due_km;
    }

    public function isDue(?float $currentKm = null, ?Carbon $at = null): bool
    {
        return $this->isDueByDate($at) || $this->isDueByDistance($currentKm);
    }

    /** Past due AND past grace — this is what makes a vehicle unfit. */
    public function isOverdue(?float $currentKm = null, ?Carbon $at = null): bool
    {
        $now = $at ?? Carbon::today();

        $dateOverdue = $this->next_due_date !== null
            && $now->gt($this->next_due_date->copy()->addDays($this->grace_days));

        $distanceOverdue = $this->next_due_km !== null && $currentKm !== null
            && $currentKm > ((float) $this->next_due_km + $this->grace_km);

        return $dateOverdue || $distanceOverdue;
    }

    /** Negative when overdue. Null when this plan has no distance rule. */
    public function kmUntilDue(?float $currentKm): ?float
    {
        if ($this->next_due_km === null || $currentKm === null) {
            return null;
        }

        return round((float) $this->next_due_km - $currentKm, 1);
    }

    /** Negative when overdue. Null when this plan has no time rule. */
    public function daysUntilDue(?Carbon $at = null): ?int
    {
        if ($this->next_due_date === null) {
            return null;
        }

        return (int) ($at ?? Carbon::today())->diffInDays($this->next_due_date, false);
    }

    /**
     * Directive 5 / D3: a plan whose ONLY rule is engine hours could never be
     * evaluated without telemetry, which is deferred. Such a plan is invalid.
     */
    public function isEvaluableWithoutTelemetry(): bool
    {
        if (! $this->relationLoaded('rules')) {
            $this->load('rules');
        }

        return $this->rules
            ->where('is_active', true)
            ->contains(fn (MaintenanceScheduleRule $rule) => ! $rule->trigger->requiresTelemetry());
    }

    public function hasTrigger(MaintenanceTrigger $trigger): bool
    {
        if (! $this->relationLoaded('rules')) {
            $this->load('rules');
        }

        return $this->rules->contains(fn (MaintenanceScheduleRule $rule) => $rule->trigger === $trigger);
    }
}
