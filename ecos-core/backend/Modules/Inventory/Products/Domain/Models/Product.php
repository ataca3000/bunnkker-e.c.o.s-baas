<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;
use Modules\Inventory\Products\Domain\Enums\CostSource;
use Modules\Inventory\Products\Domain\Enums\ProductStockStatus;
use Modules\Inventory\Products\Infrastructure\Database\Factories\ProductFactory;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\Recipe;
use Modules\MasterData\Categories\Domain\Models\Category;
use Modules\MasterData\Units\Domain\Models\Unit;
use Modules\Organization\Brands\Domain\Models\Brand;

/**
 * Product entity (UUID primary key, soft-deletable).
 *
 * @property string $id
 * @property string|null $brand_id Direct owner. Immutable after creation. Company derived via brand.
 * @property string $sku
 * @property string|null $barcode
 * @property string $name
 * @property string|null $description
 * @property string $category_id
 * @property string $unit_id
 * @property string $product_type Classification only — do not use for business logic
 * @property bool $is_active
 * @property string|null $image_url
 * @property float|null $regular_price
 * @property float|null $sale_price
 * @property float|null $last_purchase_cost Updated on every posted GR
 * @property float|null $average_cost Weighted average cost across all receipts
 * @property float|null $current_fifo_cost Cost of the oldest available receipt layer
 * @property float|null $material_cost Official Material Cost (TASK-ARCH-PRICE-001 dictionary)
 * @property float|null $product_cost Finished-good manufacturing cost (recipe_cost ÷ yield)
 * @property float|null $unit_cost product_cost ÷ yield_quantity
 * @property string|null $last_purchase_date ISO date of most recent GR post
 * @property string|null $last_supplier_id UUID of last supplier (historical, no FK)
 * @property string|null $short_description
 * @property string|null $long_description
 * @property ProductStockStatus|null $stock_status
 * @property CostSource $cost_source Which mechanism(s) update current_cost
 * @property bool $can_manufacture Has a recipe and may be produced
 * @property bool $can_disassemble May be disassembled back into components
 * @property bool $allow_negative_stock When true, reservation commits immediately even with zero or negative stock; inventory goes negative at shipment
 */
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    public const TYPE_FINISHED_GOOD = 'finished_good';

    public const TYPE_RAW_MATERIAL = 'raw_material';

    public const TYPE_PACKAGING_MATERIAL = 'packaging_material';

    /** @var list<string> */
    public const TYPES = [self::TYPE_FINISHED_GOOD, self::TYPE_RAW_MATERIAL, self::TYPE_PACKAGING_MATERIAL];

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'brand_id',
        'sku',
        'barcode',
        'name',
        'description',
        'category_id',
        'unit_id',
        'product_type',
        'is_active',
        'image_url',
        'regular_price',
        'sale_price',
        'last_purchase_cost',
        'average_cost',
        'current_fifo_cost',
        'standard_cost',
        'last_purchase_date',
        'last_supplier_id',
        'short_description',
        'long_description',
        'stock_status',
        'cost_source',
        'can_manufacture',
        'can_disassemble',
        'allow_negative_stock',
        'material_cost',
        'product_cost',
        'unit_cost',
        'pricing_mode',
        'custom_target_margin',
        'custom_markup',
        'custom_discount_pct',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'regular_price' => 'float',
            'sale_price' => 'float',
            'last_purchase_cost' => 'float',
            'average_cost' => 'float',
            'current_fifo_cost' => 'float',
            'standard_cost' => 'float',
            'material_cost' => 'float',
            'product_cost' => 'float',
            'unit_cost' => 'float',
            'custom_target_margin' => 'float',
            'custom_markup' => 'float',
            'custom_discount_pct' => 'float',
            'last_purchase_date' => 'date:Y-m-d',
            'stock_status' => ProductStockStatus::class,
            'cost_source' => CostSource::class,
            'can_manufacture' => 'boolean',
            'can_disassemble' => 'boolean',
            'allow_negative_stock' => 'boolean',
        ];
    }

    /**
     * Brand owner. Immutable after creation. Company is derived via brand → company.
     *
     * @return BelongsTo<Brand, $this>
     */
    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    /**
     * Effective target margin for pricing decisions.
     * Custom policy overrides brand default; fallback is 30%.
     */
    public function effectiveTargetMargin(): float
    {
        if ($this->pricing_mode === 'custom' && $this->custom_target_margin !== null) {
            return (float) $this->custom_target_margin;
        }

        if ($this->relationLoaded('brand') && $this->brand?->default_target_margin !== null) {
            return (float) $this->brand->default_target_margin;
        }

        return 30.0;
    }

    /**
     * Effective markup percentage.
     * Derived from effective target margin: markup = margin / (100 - margin) * 100
     */
    public function effectiveMarkup(): float
    {
        $margin = $this->effectiveTargetMargin();

        return $margin < 100 ? round($margin / (100 - $margin) * 100, 4) : 0.0;
    }

    /**
     * Effective discount percentage for sale price calculation.
     * Custom policy overrides brand default; fallback is 0% (no discount).
     */
    public function effectiveDiscountPct(): float
    {
        if ($this->pricing_mode === 'custom' && $this->custom_discount_pct !== null) {
            return (float) $this->custom_discount_pct;
        }

        if ($this->relationLoaded('brand') && $this->brand?->default_discount_pct !== null) {
            return (float) $this->brand->default_discount_pct;
        }

        return 0.0;
    }

    /**
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * @return BelongsTo<Unit, $this>
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /**
     * Inventory items across all warehouses for this product.
     *
     * @return HasMany<InventoryItem, $this>
     */
    public function inventoryItems(): HasMany
    {
        return $this->hasMany(InventoryItem::class);
    }

    /**
     * Commerce channel mappings for this product (product_channel_mappings table).
     *
     * @return HasMany<\Modules\Commerce\ProductMappings\Domain\Models\ProductMapping, $this>
     */
    public function channelMappings(): HasMany
    {
        return $this->hasMany(\Modules\Commerce\ProductMappings\Domain\Models\ProductMapping::class);
    }

    /**
     * All recipe versions for this product (newest first).
     *
     * @return HasMany<Recipe, $this>
     */
    public function recipes(): HasMany
    {
        return $this->hasMany(Recipe::class)->orderByDesc('bom_version_number');
    }

    /**
     * The currently active recipe version for this product.
     * Uses ofMany to select the highest bom_version_number among active rows.
     *
     * @return HasOne<Recipe, $this>
     */
    public function activeRecipe(): HasOne
    {
        return $this->hasOne(Recipe::class)
            ->ofMany('bom_version_number', 'max')
            ->where('is_active', true);
    }

    /** Returns true when this product has at least one active recipe. */
    public function hasRecipe(): bool
    {
        return $this->recipes()->where('is_active', true)->exists();
    }

    /**
     * Pricing reviews for this product.
     *
     * @return HasMany<\Modules\CostManagement\Domain\Models\PricingReview, $this>
     */
    public function pricingReviews(): HasMany
    {
        return $this->hasMany(\Modules\CostManagement\Domain\Models\PricingReview::class);
    }

    protected static function newFactory(): ProductFactory
    {
        return ProductFactory::new();
    }
}
