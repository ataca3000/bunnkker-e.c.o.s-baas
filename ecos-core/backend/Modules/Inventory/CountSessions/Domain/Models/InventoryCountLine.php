<?php

declare(strict_types=1);

namespace Modules\Inventory\CountSessions\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * @property string $id
 * @property string $session_id
 * @property string $product_id
 * @property string|null $inventory_item_id
 * @property float $system_qty
 * @property float|null $counted_qty
 * @property float|null $variance_qty
 * @property float|null $variance_value
 * @property string|null $notes
 *                              Phase 1.1: photo_path deferred — see PKG-COUNT-002
 */
class InventoryCountLine extends Model
{
    use HasUuids;

    protected $table = 'inventory_count_lines';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'session_id',
        'product_id',
        'inventory_item_id',
        'system_qty',
        'counted_qty',
        'damaged_qty',
        'damage_reason',
        'shortage_qty',
        'variance_qty',
        'variance_value',
        'unit_cost_snapshot',
        'notes',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'system_qty' => 'decimal:4',
            'counted_qty' => 'decimal:4',
            'damaged_qty' => 'decimal:4',
            'shortage_qty' => 'decimal:4',
            'variance_qty' => 'decimal:4',
            'variance_value' => 'decimal:2',
            'unit_cost_snapshot' => 'decimal:4',
        ];
    }

    /** @return BelongsTo<InventoryCountSession, $this> */
    public function session(): BelongsTo
    {
        return $this->belongsTo(InventoryCountSession::class, 'session_id');
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<InventoryItem, $this> */
    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    /** @return HasMany<InventoryCountLineAttachment, $this> */
    public function attachments(): HasMany
    {
        return $this->hasMany(InventoryCountLineAttachment::class, 'count_line_id');
    }
}
