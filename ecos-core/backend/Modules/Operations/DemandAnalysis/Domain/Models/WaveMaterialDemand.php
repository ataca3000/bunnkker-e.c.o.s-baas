<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Read model: aggregated raw-material demand for a preparation wave.
 * Required quantities are derived from BOM explosion of product demand.
 * Available/reserved quantities are sourced from inventory_items at calculation time.
 *
 * @property string $id
 * @property string $company_id
 * @property string $warehouse_id
 * @property string $preparation_wave_id
 * @property string $material_id
 * @property string $material_name
 * @property string|null $material_sku
 * @property float $required_qty
 * @property float $available_qty
 * @property float $reserved_qty
 * @property float $expected_today
 * @property float $in_transit_qty
 * @property float $missing_qty
 * @property float $coverage_pct
 * @property string|null $data_hash
 * @property \Carbon\Carbon $last_calculated_at
 */
final class WaveMaterialDemand extends Model
{
    use HasUuids;

    protected $table = 'wave_material_demand';

    protected $fillable = [
        'id',
        'company_id',
        'warehouse_id',
        'preparation_wave_id',
        'material_id',
        'material_name',
        'material_sku',
        'required_qty',
        'available_qty',
        'reserved_qty',
        'expected_today',
        'in_transit_qty',
        'missing_qty',
        'coverage_pct',
        'data_hash',
        'last_calculated_at',
    ];

    protected $casts = [
        'required_qty' => 'float',
        'available_qty' => 'float',
        'reserved_qty' => 'float',
        'expected_today' => 'float',
        'in_transit_qty' => 'float',
        'missing_qty' => 'float',
        'coverage_pct' => 'float',
        'last_calculated_at' => 'datetime',
    ];

    /** @return BelongsTo<PreparationWave, self> */
    public function wave(): BelongsTo
    {
        return $this->belongsTo(PreparationWave::class, 'preparation_wave_id');
    }
}
