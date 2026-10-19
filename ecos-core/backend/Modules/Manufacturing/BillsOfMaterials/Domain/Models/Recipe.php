<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Domain\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Recipe aggregate — domain language for BillOfMaterial.
 *
 * Persistence: bills_of_materials table (shared with BillOfMaterial).
 * Recipe is the manufacturing domain term; BillOfMaterial is the persistence term.
 *
 * Rules:
 *  - One output product per recipe.
 *  - Components are absolute quantities only (no waste_percentage).
 *  - One active version per product at a time.
 *  - Unit comes from the component's Product.unit — no separate unit on RecipeLine.
 *
 * @property string $id
 * @property string $bom_number
 * @property string $product_id
 * @property string $version Display label (e.g. "1.0", "2.1")
 * @property int $bom_version_number Monotonically increasing integer per product
 * @property bool $is_active
 * @property string|null $notes
 */
class Recipe extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'bills_of_materials';

    protected $fillable = [
        'bom_number',
        'product_id',
        'version',
        'bom_version_number',
        'is_active',
        'notes',
        'manufacturing_cost',
        'other_costs',
        'execution_instructions',
        'yield_quantity',
        'recipe_cost',
        'recipe_cost_updated_at',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'bom_version_number' => 'integer',
            'manufacturing_cost' => 'float',
            'other_costs' => 'float',
            'yield_quantity' => 'float',
            'recipe_cost' => 'float',
            'recipe_cost_updated_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** All recipe components (lines). */
    public function components(): HasMany
    {
        return $this->hasMany(RecipeLine::class, 'bom_id');
    }

    /** Alias for components() — maintains BOM-layer compatibility. */
    public function lines(): HasMany
    {
        return $this->components();
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
