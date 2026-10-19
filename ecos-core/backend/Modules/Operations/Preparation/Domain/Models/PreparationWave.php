<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $warehouse_id
 * @property string|null $preparation_session_id
 * @property string $wave_number
 * @property \Carbon\Carbon $planning_date
 * @property WaveStatus $status
 * @property int $orders_count
 * @property int $products_count
 * @property int $lines_count
 * @property float $total_units_required
 * @property float $total_units_prepared
 * @property bool $shortage_detected
 * @property string|null $shortage_resolved_by
 * @property \Carbon\Carbon|null $shortage_resolved_at
 * @property string|null $approved_by
 * @property \Carbon\Carbon|null $approved_at
 * @property string|null $started_by
 * @property \Carbon\Carbon|null $started_at
 * @property string|null $completed_by
 * @property \Carbon\Carbon|null $completed_at
 * @property string|null $cancelled_by
 * @property \Carbon\Carbon|null $cancelled_at
 * @property string|null $cancellation_reason
 * @property string|null $brand_id
 * @property string|null $channel_id
 * @property string|null $delivery_window_id
 * @property string|null $delivery_window_label
 * @property array|null $policy_snapshot
 * @property string $wave_type
 * @property int|null $priority_score
 * @property string|null $config_version_id
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class PreparationWave extends Model
{
    use HasUuids;

    protected $table = 'preparation_waves';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'warehouse_id',
        'preparation_session_id',
        'wave_number',
        'planning_date',
        'status',
        'orders_count',
        'products_count',
        'lines_count',
        'total_units_required',
        'total_units_prepared',
        'shortage_detected',
        'shortage_resolved_at',
        'shortage_resolved_by',
        'approved_at',
        'approved_by',
        'started_at',
        'started_by',
        'completed_at',
        'completed_by',
        'cancelled_at',
        'cancelled_by',
        'cancellation_reason',
        'brand_id',
        'channel_id',
        'delivery_window_id',
        'delivery_window_label',
        'policy_snapshot',
        'wave_type',
        'priority_score',
        'config_version_id',
        'notes',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'planning_date' => 'date:Y-m-d',
            'status' => WaveStatus::class,
            'shortage_detected' => 'boolean',
            'orders_count' => 'integer',
            'products_count' => 'integer',
            'lines_count' => 'integer',
            'total_units_required' => 'float',
            'total_units_prepared' => 'float',
            'shortage_resolved_at' => 'datetime',
            'approved_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'policy_snapshot' => 'array',
            'priority_score' => 'integer',
        ];
    }

    public function completionPct(): float
    {
        if ($this->total_units_required <= 0) {
            return 0.0;
        }

        return round(($this->total_units_prepared / $this->total_units_required) * 100, 1);
    }

    /** @return BelongsTo<PreparationSession, $this> */
    public function session(): BelongsTo
    {
        return $this->belongsTo(PreparationSession::class, 'preparation_session_id');
    }

    /** @return HasMany<PreparationWaveOrder, $this> */
    public function waveOrders(): HasMany
    {
        return $this->hasMany(PreparationWaveOrder::class, 'preparation_wave_id');
    }

    /** @return HasMany<PreparationWaveItem, $this> */
    public function waveItems(): HasMany
    {
        return $this->hasMany(PreparationWaveItem::class, 'preparation_wave_id');
    }

    /** @return HasMany<PreparationMaterialRequirement, $this> */
    public function materialRequirements(): HasMany
    {
        return $this->hasMany(PreparationMaterialRequirement::class, 'preparation_wave_id');
    }

    /** @return HasMany<PreparationProductionRequirement, $this> */
    public function productionRequirements(): HasMany
    {
        return $this->hasMany(PreparationProductionRequirement::class, 'preparation_wave_id');
    }

    /** @return HasOne<PreparationPickList, $this> */
    public function pickList(): HasOne
    {
        return $this->hasOne(PreparationPickList::class, 'preparation_wave_id');
    }

    /** @return HasMany<PreparationWaveWorker, $this> */
    public function workers(): HasMany
    {
        return $this->hasMany(PreparationWaveWorker::class, 'preparation_wave_id');
    }

    /** @return HasMany<PreparationException, $this> */
    public function exceptions(): HasMany
    {
        return $this->hasMany(PreparationException::class, 'preparation_wave_id');
    }

    /** @return HasMany<PreparedProductsPool, $this> */
    public function poolEntries(): HasMany
    {
        return $this->hasMany(PreparedProductsPool::class, 'preparation_wave_id');
    }
}
