<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Operations\Preparation\Domain\Enums\WaveItemStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $preparation_wave_id
 * @property string $product_id
 * @property string $sku_snapshot
 * @property string $name_snapshot
 * @property float $quantity_required
 * @property float $quantity_prepared
 * @property float $quantity_short
 * @property WaveItemStatus $status
 * @property \Carbon\Carbon|null $prepared_at
 * @property string|null $prepared_by
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class PreparationWaveItem extends Model
{
    use HasUuids;

    protected $table = 'preparation_wave_items';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'preparation_wave_id',
        'product_id',
        'sku_snapshot',
        'name_snapshot',
        'quantity_required',
        'quantity_prepared',
        'quantity_short',
        'status',
        'prepared_at',
        'prepared_by',
        'notes',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => WaveItemStatus::class,
            'quantity_required' => 'float',
            'quantity_prepared' => 'float',
            'quantity_short' => 'float',
            'prepared_at' => 'datetime',
        ];
    }

    public function completionPct(): float
    {
        if ($this->quantity_required <= 0) {
            return 0.0;
        }

        return round(($this->quantity_prepared / $this->quantity_required) * 100, 1);
    }

    /** @return BelongsTo<PreparationWave, $this> */
    public function wave(): BelongsTo
    {
        return $this->belongsTo(PreparationWave::class, 'preparation_wave_id');
    }
}
