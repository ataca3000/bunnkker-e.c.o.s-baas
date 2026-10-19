<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Operations\Preparation\Domain\Enums\SessionStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $warehouse_id
 * @property string $session_number
 * @property \Carbon\Carbon $planning_date
 * @property SessionStatus $status
 * @property string $operator_id
 * @property string|null $supervisor_id
 * @property int $waves_count
 * @property int $products_count
 * @property float $total_units_required
 * @property float $total_units_prepared
 * @property \Carbon\Carbon|null $started_at
 * @property string|null $started_by
 * @property \Carbon\Carbon|null $paused_at
 * @property string|null $paused_by
 * @property \Carbon\Carbon|null $planned_at
 * @property string|null $planned_by
 * @property \Carbon\Carbon|null $completed_at
 * @property string|null $completed_by
 * @property \Carbon\Carbon|null $approved_at
 * @property string|null $approved_by
 * @property \Carbon\Carbon|null $closed_at
 * @property string|null $closed_by
 * @property \Carbon\Carbon|null $cancelled_at
 * @property string|null $cancelled_by
 * @property string|null $cancellation_reason
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property bool $auto_created CR-PREP-001: true when created by scheduler
 * @property string|null $policy_id CR-PREP-001: FK → preparation_session_policies
 * @property int $orders_count CR-PREP-001: denormalized active-orders count
 * @property \Carbon\Carbon|null $frozen_at CR-PREP-001 Part 3: when session was frozen
 * @property string|null $frozen_by CR-PREP-001 Part 3: who froze the session
 */
class PreparationSession extends Model
{
    use HasUuids;

    protected $table = 'preparation_sessions';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'warehouse_id',
        'session_number',
        'planning_date',
        'status',
        'operator_id',
        'supervisor_id',
        'waves_count',
        'products_count',
        'total_units_required',
        'total_units_prepared',
        'started_at',
        'started_by',
        'paused_at',
        'paused_by',
        'planned_at',
        'planned_by',
        'completed_at',
        'completed_by',
        'approved_at',
        'approved_by',
        'closed_at',
        'closed_by',
        'cancelled_at',
        'cancelled_by',
        'cancellation_reason',
        'notes',
        'created_by',
        'updated_by',
        // CR-PREP-001
        'auto_created',
        'policy_id',
        'orders_count',
        'frozen_at',
        'frozen_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'planning_date' => 'date:Y-m-d',
            'status' => SessionStatus::class,
            'waves_count' => 'integer',
            'products_count' => 'integer',
            'auto_created' => 'boolean',
            'orders_count' => 'integer',
            'frozen_at' => 'datetime',
            'total_units_required' => 'float',
            'total_units_prepared' => 'float',
            'started_at' => 'datetime',
            'paused_at' => 'datetime',
            'planned_at' => 'datetime',
            'completed_at' => 'datetime',
            'approved_at' => 'datetime',
            'closed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function completionPct(): float
    {
        if ($this->total_units_required <= 0) {
            return 0.0;
        }

        return round(($this->total_units_prepared / $this->total_units_required) * 100, 1);
    }

    /** @return HasMany<PreparationWave, $this> */
    public function waves(): HasMany
    {
        return $this->hasMany(PreparationWave::class, 'preparation_session_id');
    }
}
