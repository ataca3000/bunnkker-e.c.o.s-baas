<?php

declare(strict_types=1);

namespace Modules\Operations\DemandAnalysis\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

/**
 * Read model: aggregated product demand for a preparation wave.
 * Written by the Demand Engine, consumed by the Preparation Workspace UI.
 *
 * @property string $id
 * @property string $company_id
 * @property string $warehouse_id
 * @property string $preparation_wave_id
 * @property string $product_id
 * @property string $product_name
 * @property string|null $product_sku
 * @property float $required_qty
 * @property float $prepared_qty
 * @property float $remaining_qty
 * @property int $orders_count
 * @property float $completion_pct
 * @property string|null $data_hash
 * @property \Carbon\Carbon $last_calculated_at
 */
final class WaveProductDemand extends Model
{
    use HasUuids;

    protected $table = 'wave_product_demand';

    protected $fillable = [
        'id',
        'company_id',
        'warehouse_id',
        'preparation_wave_id',
        'product_id',
        'product_name',
        'product_sku',
        'required_qty',
        'prepared_qty',
        'remaining_qty',
        'orders_count',
        'completion_pct',
        'data_hash',
        'last_calculated_at',
    ];

    protected $casts = [
        'required_qty' => 'float',
        'prepared_qty' => 'float',
        'remaining_qty' => 'float',
        'orders_count' => 'integer',
        'completion_pct' => 'float',
        'last_calculated_at' => 'datetime',
    ];

    /** @return BelongsTo<PreparationWave, self> */
    public function wave(): BelongsTo
    {
        return $this->belongsTo(PreparationWave::class, 'preparation_wave_id');
    }
}
