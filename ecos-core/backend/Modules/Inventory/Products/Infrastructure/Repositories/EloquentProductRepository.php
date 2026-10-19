<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Modules\Inventory\Products\Domain\Contracts\ProductRepositoryInterface;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Eloquent implementation of the product repository.
 */
final class EloquentProductRepository implements ProductRepositoryInterface
{
    /** Columns that may be sorted on (whitelist). */
    private const SORTABLE = ['sku', 'name', 'product_type', 'is_active', 'created_at', 'material_cost'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        // Canonical inventory summary flag (EPIC-DATA-CONSOLIDATION-001, Phase B/D).
        // OFF (default): legacy sum-then-clamp availability + material_cost value —
        // byte-identical to prior behaviour. ON: canonical clamp-per-warehouse-then-sum
        // + FIFO value, matching InventorySummaryService / EnterpriseCostEngine.
        $canonicalSummary = (bool) config('inventory_ledger.canonical_summary');

        $availableExpr = $canonicalSummary
            ? 'COALESCE(inv_agg.inv_available, 0)'
            : 'GREATEST(COALESCE(inv_agg.inv_on_hand, 0) - COALESCE(inv_agg.inv_reserved, 0), 0)';

        $valueExpr = $canonicalSummary
            ? '(SELECT COALESCE(SUM(irl.remaining_qty * irl.landed_unit_cost), 0) FROM inventory_receipt_layers irl WHERE irl.product_id = products.id AND irl.remaining_qty > 0)'
            : 'COALESCE(inv_agg.inv_on_hand, 0) * COALESCE(products.material_cost, 0)';

        $compAvailExpr = $canonicalSummary
            ? 'SUM(GREATEST(ii_c.on_hand_qty - ii_c.reserved_qty, 0.0))'
            : 'GREATEST(SUM(ii_c.on_hand_qty) - SUM(ii_c.reserved_qty), 0.0)';

        $query = Product::query()
            ->with(['category', 'unit', 'activeRecipe', 'channelMappings.channel.brand.company', 'brand.company'])
            ->select('products.*')
            ->leftJoinSub(
                DB::table('inventory_items')
                    ->whereNull('deleted_at')
                    ->selectRaw('product_id, SUM(on_hand_qty) as inv_on_hand, SUM(reserved_qty) as inv_reserved, SUM(GREATEST(on_hand_qty - reserved_qty, 0)) as inv_available')
                    ->groupBy('product_id'),
                'inv_agg',
                'products.id',
                '=',
                'inv_agg.product_id',
            )
            ->addSelect(
                DB::raw('COALESCE(inv_agg.inv_on_hand, 0) as on_hand_qty'),
                DB::raw('COALESCE(inv_agg.inv_reserved, 0) as reserved_qty'),
                DB::raw($availableExpr . ' as agg_available_qty'),
                DB::raw($valueExpr . ' as inventory_value'),
                DB::raw("EXISTS(SELECT 1 FROM pricing_reviews WHERE pricing_reviews.product_id = products.id AND pricing_reviews.status = 'pending') as has_pending_review"),
                DB::raw("(CASE
                    WHEN products.product_type != 'finished_good' THEN NULL
                    WHEN NOT EXISTS (
                        SELECT 1 FROM bills_of_materials bom_chk
                        WHERE bom_chk.product_id = products.id
                          AND bom_chk.is_active = TRUE
                          AND bom_chk.deleted_at IS NULL
                    ) THEN 'recipe_missing'
                    WHEN EXISTS (
                        SELECT 1 FROM bill_of_material_lines boml_chk
                        JOIN bills_of_materials bom_chk2
                          ON bom_chk2.id = boml_chk.bom_id
                         AND bom_chk2.is_active = TRUE
                         AND bom_chk2.deleted_at IS NULL
                        JOIN products comp_chk
                          ON comp_chk.id = boml_chk.raw_material_id
                         AND comp_chk.deleted_at IS NULL
                        LEFT JOIN (
                            SELECT ii_c.product_id,
                                   {$compAvailExpr} AS avail
                            FROM inventory_items ii_c
                            WHERE ii_c.deleted_at IS NULL
                            GROUP BY ii_c.product_id
                        ) inv_comp ON inv_comp.product_id = comp_chk.id
                        WHERE bom_chk2.product_id = products.id
                          AND COALESCE(inv_comp.avail, 0) <= 0
                          AND (comp_chk.allow_negative_stock IS NULL OR comp_chk.allow_negative_stock = FALSE)
                    ) THEN 'outofstock'
                    ELSE 'instock'
                END) as manufacturing_availability"),
            );

        $categoryId = trim((string) ($filters['category_id'] ?? ''));
        if ($categoryId !== '') {
            $query->where('products.category_id', $categoryId);
        }

        $unitId = trim((string) ($filters['unit_id'] ?? ''));
        if ($unitId !== '') {
            $query->where('products.unit_id', $unitId);
        }

        $productType = trim((string) ($filters['product_type'] ?? ''));
        if (in_array($productType, Product::TYPES, true)) {
            $query->where('products.product_type', $productType);
        }

        // Multiple types (comma-separated) — e.g. 'raw_material,packaging_material'
        $productTypes = trim((string) ($filters['product_types'] ?? ''));
        if ($productTypes !== '') {
            $validTypes = array_values(array_filter(
                array_map('trim', explode(',', $productTypes)),
                fn (string $t) => in_array($t, Product::TYPES, true),
            ));
            if ($validTypes !== []) {
                $query->whereIn('products.product_type', $validTypes);
            }
        }

        $stockStatus = trim((string) ($filters['stock_status'] ?? ''));
        if ($stockStatus !== '') {
            $query->where('products.stock_status', $stockStatus);
        }

        $allowNegative = $filters['allow_negative'] ?? null;
        if ($allowNegative !== null && $allowNegative !== '') {
            $query->where('products.allow_negative_stock', (bool) $allowNegative);
        }

        $brandId = trim((string) ($filters['brand_id'] ?? ''));
        if ($brandId !== '') {
            $query->where('products.brand_id', $brandId);
        }

        // company_id filter: resolve through brand → company (no direct column on products post-ADR-013)
        $companyIdFilter = trim((string) ($filters['company_id'] ?? ''));
        if ($companyIdFilter !== '') {
            $query->whereHas('brand', fn ($q) => $q->where('company_id', $companyIdFilter));
        }

        $channelIdFilter = trim((string) ($filters['channel_id'] ?? ''));
        if ($channelIdFilter !== '') {
            $query->whereHas(
                'channelMappings',
                fn ($q) => $q->where('channel_id', $channelIdFilter),
            );
        }

        if (! empty($filters['eligible_for_recipe'])) {
            $query->whereDoesntHave('recipes', fn ($q) => $q->where('is_active', true));
        }

        $hasRecipe = $filters['has_recipe'] ?? null;
        if ($hasRecipe === 'true' || $hasRecipe === true || $hasRecipe === '1') {
            $query->whereHas('recipes', fn ($q) => $q->where('is_active', true));
        } elseif ($hasRecipe === 'false' || $hasRecipe === false || $hasRecipe === '0') {
            $query->whereDoesntHave('recipes', fn ($q) => $q->where('is_active', true));
        }

        if (! empty($filters['needs_pricing_review'])) {
            $query->whereExists(function ($sub): void {
                $sub->select(DB::raw(1))
                    ->from('pricing_reviews')
                    ->whereColumn('pricing_reviews.product_id', 'products.id')
                    ->where('pricing_reviews.status', 'pending');
            });
        }

        if (! empty($filters['low_margin'])) {
            $query->whereNotNull('products.regular_price')
                ->where('products.regular_price', '>', 0)
                ->whereNotNull('products.product_cost')
                ->whereRaw('(products.regular_price - products.product_cost) / products.regular_price < 0.20');
        }

        if (! empty($filters['manufacturing_ready'])) {
            $query->whereHas('recipes', fn ($q) => $q->where('is_active', true))
                ->whereNotNull('products.regular_price')
                ->where('products.regular_price', '>', 0)
                ->whereNotNull('products.image_url')
                ->where('products.image_url', '!=', '')
                ->whereHas('channelMappings');
        }

        $mavFilter = trim((string) ($filters['manufacturing_availability'] ?? ''));
        if ($mavFilter !== '' && in_array($mavFilter, ['instock', 'outofstock', 'recipe_missing'], true)) {
            $query->where('products.product_type', 'finished_good');

            if ($mavFilter === 'recipe_missing') {
                $query->whereDoesntHave('recipes', fn ($q) => $q->where('is_active', true));
            } else {
                $query->whereHas('recipes', fn ($q) => $q->where('is_active', true));

                $blockingExists = fn ($sub) => $sub
                    ->select(DB::raw(1))
                    ->from('bill_of_material_lines as boml_f')
                    ->join('bills_of_materials as bom_f', function ($j): void {
                        $j->on('bom_f.id', '=', 'boml_f.bom_id')
                            ->where('bom_f.is_active', true)
                            ->whereNull('bom_f.deleted_at');
                    })
                    ->join('products as comp_f', function ($j): void {
                        $j->on('comp_f.id', '=', 'boml_f.raw_material_id')
                            ->whereNull('comp_f.deleted_at');
                    })
                    ->leftJoinSub(
                        DB::table('inventory_items')
                            ->whereNull('deleted_at')
                            ->selectRaw('product_id, GREATEST(SUM(on_hand_qty) - SUM(reserved_qty), 0.0) as avail')
                            ->groupBy('product_id'),
                        'inv_f',
                        'inv_f.product_id',
                        '=',
                        'comp_f.id',
                    )
                    ->whereColumn('bom_f.product_id', 'products.id')
                    ->whereRaw('COALESCE(inv_f.avail, 0) <= 0')
                    ->whereRaw('(comp_f.allow_negative_stock IS NULL OR comp_f.allow_negative_stock = FALSE)');

                if ($mavFilter === 'outofstock') {
                    $query->whereExists($blockingExists);
                } else {
                    $query->whereNotExists($blockingExists);
                }
            }
        }

        $warehouseId = trim((string) ($filters['warehouse_id'] ?? ''));
        if ($warehouseId !== '') {
            $query->whereExists(function ($sub) use ($warehouseId): void {
                $sub->select(DB::raw(1))
                    ->from('inventory_items')
                    ->whereNull('inventory_items.deleted_at')
                    ->whereColumn('inventory_items.product_id', 'products.id')
                    ->where('inventory_items.warehouse_id', $warehouseId);
            });
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where('products.sku', 'like', "%{$search}%")
                    ->orWhere('products.barcode', 'like', "%{$search}%")
                    ->orWhere('products.name', 'like', "%{$search}%")
                    ->orWhere('products.description', 'like', "%{$search}%");
            });
        }

        $status = (string) ($filters['status'] ?? 'all');
        if ($status === 'active') {
            $query->where('products.is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('products.is_active', false);
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        if (! in_array($sortBy, self::SORTABLE, true)) {
            $sortBy = 'created_at';
        }
        $sortBy = $sortBy === 'created_at' ? 'products.created_at' : "products.{$sortBy}";

        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';

        $perPage = (int) ($filters['per_page'] ?? 10);
        $perPage = max(1, min($perPage, 100));

        return $query->orderBy($sortBy, $sortDir)->paginate($perPage);
    }

    public function findById(string $id): ?Product
    {
        return Product::query()->with(['category', 'unit', 'activeRecipe.components', 'channelMappings.channel.brand.company', 'brand.company'])->find($id);
    }

    public function create(array $attributes): Product
    {
        $product = Product::query()->create($attributes);

        return $product->load(['category', 'unit', 'channelMappings.channel.brand.company', 'brand.company']);
    }

    public function update(Product $product, array $attributes): Product
    {
        // unit_id is optional in the form — skip null to preserve the existing value
        if (array_key_exists('unit_id', $attributes) && $attributes['unit_id'] === null) {
            unset($attributes['unit_id']);
        }

        $product->update($attributes);

        return $product->load(['category', 'unit', 'channelMappings.channel.brand.company', 'brand.company']);
    }

    public function delete(Product $product): void
    {
        $product->delete();
    }
}
