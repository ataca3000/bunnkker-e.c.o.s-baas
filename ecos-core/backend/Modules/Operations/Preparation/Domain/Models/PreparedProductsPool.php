<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Operations\Preparation\Domain\Enums\QualityStatus;

/**
 * @property string $id
 * @property string $company_id
 * @property string $warehouse_id
 * @property string $product_id
 * @property string $sku_snapshot
 * @property string $name_snapshot
 * @property string $preparation_wave_id
 * @property float $quantity_available
 * @property float $quantity_reserved
 * @property float $quantity_loaded
 * @property QualityStatus $quality_status
 * @property string|null $quality_checked_by
 * @property \Carbon\Carbon|null $quality_checked_at
 * @property \Carbon\Carbon $prepared_at
 * @property string|null $reserved_for_wave_id
 * @property string|null $notes
 * @property string $created_by
 * @property string $updated_by
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class PreparedProductsPool extends Model
{
    use HasUuids;

    protected $table = 'prepared_products_pool';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'company_id',
        'warehouse_id',
        'product_id',
        'sku_snapshot',
        'name_snapshot',
        'preparation_wave_id',
        'quantity_available',
        'quantity_reserved',
        'quantity_loaded',
        'quality_status',
        'quality_checked_by',
        'quality_checked_at',
        'shipping_gate_opened',
        'gate_opened_by',
        'gate_opened_at',
        'prepared_at',
        'reserved_for_wave_id',
        'notes',
        'created_by',
        'updated_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'quality_status' => QualityStatus::class,
            'quantity_available' => 'float',
            'quantity_reserved' => 'float',
            'quantity_loaded' => 'float',
            'quality_checked_at' => 'datetime',
            'shipping_gate_opened' => 'boolean',
            'gate_opened_at' => 'datetime',
            'prepared_at' => 'datetime',
        ];
    }

    public function canBeReserved(): bool
    {
        // Shipping gate must be open (set by ApproveSessionAction).
        // Legacy pool entries (pre-gate feature) have shipping_gate_opened = true by default.
        if (! $this->shipping_gate_opened) {
            return false;
        }

        return $this->quality_status->canBeReserved()
            && $this->quantity_available > 0;
    }

    /** @return HasMany<PreparedPoolMovement, $this> */
    public function movements(): HasMany
    {
        return $this->hasMany(PreparedPoolMovement::class, 'pool_entry_id');
    }
}
