<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\DemandAnalysis\Domain\Enums\MaterialPriority;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Read model: only materials with shortage > 0.
 * Derived from WaveMaterialDemand after each recalculation.
 *
 * @property string $id
 * @property string $company_id
 * @property string $warehouse_id
 * @property string $preparation_wave_id
 * @property string $material_id
 * @property string $material_name
 * @property float $missing_qty
 * @property int $affected_orders_count
 * @property MaterialPriority $priority
 * @property string|null $procurement_status
 * @property \Carbon\Carbon $last_calculated_at
 */
final class WaveMissingMaterial extends Model
{
    use HasUuids;

    protected $table = 'wave_missing_materials';

    protected $fillable = [
        'id',
        'company_id',
        'warehouse_id',
        'preparation_wave_id',
        'material_id',
        'material_name',
        'missing_qty',
        'affected_orders_count',
        'priority',
        'procurement_status',
        'last_calculated_at',
    ];

    protected $casts = [
        'missing_qty' => 'float',
        'affected_orders_count' => 'integer',
        'priority' => MaterialPriority::class,
        'last_calculated_at' => 'datetime',
    ];

    /** @return BelongsTo<PreparationWave, self> */
    public function wave(): BelongsTo
    {
        return $this->belongsTo(PreparationWave::class, 'preparation_wave_id');
    }
}
