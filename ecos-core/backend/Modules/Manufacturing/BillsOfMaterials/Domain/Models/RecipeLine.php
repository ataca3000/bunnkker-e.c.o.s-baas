<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * RecipeLine — a single component in a Recipe.
 *
 * Persistence: bill_of_material_lines table (shared with BillOfMaterialLine).
 *
 * Rules:
 *  - quantity is an absolute amount (never percentage-based).
 *  - Unit is derived from the component Product's unit relationship.
 *  - Component (raw_material_id) must differ from the Recipe's product_id.
 *
 * @property string $id
 * @property string $bom_id
 * @property string $raw_material_id
 * @property float $quantity
 */
class RecipeLine extends Model
{
    use HasUuids;

    protected $table = 'bill_of_material_lines';

    protected $fillable = [
        'bom_id',
        'raw_material_id',
        'quantity',
        'waste_percentage',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'waste_percentage' => 'float',
        ];
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class, 'bom_id');
    }

    /** The component product (raw material or sub-assembly). */
    public function component(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'raw_material_id');
    }

    /** Legacy alias used by BOM-layer eager loads (e.g. 'lines.rawMaterial.unit'). */
    public function rawMaterial(): BelongsTo
    {
        return $this->component();
    }
}
