<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Read model: manufacturing demand per finished product per wave.
 * Tracks how much needs to be made vs. what is planned/in-progress/done.
 *
 * @property string $id
 * @property string $company_id
 * @property string $warehouse_id
 * @property string $preparation_wave_id
 * @property string $product_id
 * @property string $product_name
 * @property float $required_qty
 * @property float $planned_qty
 * @property float $manufacturing_qty
 * @property float $completed_qty
 * @property float $remaining_qty
 * @property \Carbon\Carbon $last_calculated_at
 */
final class WaveManufacturingDemand extends Model
{
    use HasUuids;

    protected $table = 'wave_manufacturing_demand';

    protected $fillable = [
        'id',
        'company_id',
        'warehouse_id',
        'preparation_wave_id',
        'product_id',
        'product_name',
        'required_qty',
        'planned_qty',
        'manufacturing_qty',
        'completed_qty',
        'remaining_qty',
        'last_calculated_at',
    ];

    protected $casts = [
        'required_qty' => 'float',
        'planned_qty' => 'float',
        'manufacturing_qty' => 'float',
        'completed_qty' => 'float',
        'remaining_qty' => 'float',
        'last_calculated_at' => 'datetime',
    ];

    /** @return BelongsTo<PreparationWave, self> */
    public function wave(): BelongsTo
    {
        return $this->belongsTo(PreparationWave::class, 'preparation_wave_id');
    }
}
