<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Read model: single KPI summary row per wave.
 * Aggregated from all demand read models after each recalculation.
 *
 * @property string $id
 * @property string $company_id
 * @property string $warehouse_id
 * @property string $preparation_wave_id
 * @property int $orders_count
 * @property int $products_count
 * @property int $materials_count
 * @property int $missing_materials_count
 * @property int $prepared_count
 * @property int $remaining_count
 * @property float $completion_pct
 * @property \Carbon\Carbon $last_calculated_at
 */
final class WaveKpi extends Model
{
    use HasUuids;

    protected $table = 'wave_kpis';

    protected $fillable = [
        'id',
        'company_id',
        'warehouse_id',
        'preparation_wave_id',
        'orders_count',
        'products_count',
        'materials_count',
        'missing_materials_count',
        'prepared_count',
        'remaining_count',
        'completion_pct',
        'last_calculated_at',
    ];

    protected $casts = [
        'orders_count' => 'integer',
        'products_count' => 'integer',
        'materials_count' => 'integer',
        'missing_materials_count' => 'integer',
        'prepared_count' => 'integer',
        'remaining_count' => 'integer',
        'completion_pct' => 'float',
        'last_calculated_at' => 'datetime',
    ];

    /** @return BelongsTo<PreparationWave, self> */
    public function wave(): BelongsTo
    {
        return $this->belongsTo(PreparationWave::class, 'preparation_wave_id');
    }
}
