<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Logistics\Fleet\Domain\Enums\MaintenanceTrigger;

/**
 * One leg of a ServiceInterval. "Every 10,000 km or 6 months, whichever first"
 * is two rows on the same plan.
 */
class MaintenanceScheduleRule extends Model
{
    protected $table = 'fleet_maintenance_schedule_rules';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_active' => true,
    ];

    protected $fillable = [
        'maintenance_plan_id', 'trigger', 'interval_value', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'trigger' => MaintenanceTrigger::class,
            'interval_value' => 'decimal:1',
            'is_active' => 'boolean',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(MaintenancePlan::class, 'maintenance_plan_id');
    }

    public function unitLabel(): string
    {
        return $this->trigger->unit();
    }
}
