<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * @property string $id
 * @property string $purchase_material_id
 * @property string $product_id
 * @property string $requested_qty
 * @property string|null $unit_label
 * @property string|null $notes
 */
class PurchaseMaterialLine extends Model
{
    use HasUuids;

    protected $table = 'purchase_material_lines';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'purchase_material_id',
        'product_id',
        'requested_qty',
        'unit_label',
        'notes',
        'supplier_id',
        'agreed_price',
        'agreed_qty',
        'lead_time_days',
        'supplier_selected_at',
        'supplier_selected_by',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'requested_qty' => 'decimal:4',
            'agreed_price' => 'decimal:4',
            'agreed_qty' => 'decimal:4',
            'lead_time_days' => 'integer',
            'supplier_selected_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<PurchaseMaterial, $this> */
    public function purchaseMaterial(): BelongsTo
    {
        return $this->belongsTo(PurchaseMaterial::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
