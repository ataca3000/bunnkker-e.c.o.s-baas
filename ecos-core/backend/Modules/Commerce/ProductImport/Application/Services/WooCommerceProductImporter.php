<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductImport\Application\Services;

use Illuminate\Support\Facades\Http;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\ProductImport\Application\DTO\ImportResultDTO;
use Modules\Commerce\ProductMappings\Domain\Enums\SyncStatus;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Categories\Domain\Models\Category;
use Modules\MasterData\Units\Domain\Models\Unit;
use Throwable;

final class WooCommerceProductImporter
{
    private const PER_PAGE = 100;

    private const TIMEOUT = 30;

    private const VALID_STOCK_STATUSES = ['instock', 'outofstock', 'onbackorder'];

    private const MAX_CATEGORY_DEPTH = 3;

    private int $categoriesCreated = 0;

    private int $categoriesUpdated = 0;

    public function import(Channel $channel): ImportResultDTO
    {
        $this->categoriesCreated = 0;
        $this->categoriesUpdated = 0;

        $credential = $channel->credential;

        if ($credential === null) {
            return new ImportResultDTO(0, 0, 0, 0, 0, 0, ['No credentials configured for this channel.']);
        }

        $defaultCategory = Category::query()->first();
        $defaultUnit = Unit::query()->first();

        if ($defaultCategory === null || $defaultUnit === null) {
            return new ImportResultDTO(0, 0, 0, 0, 0, 0, [
                'No default category or unit found. Create at least one category and one unit before importing.',
            ]);
        }

        $baseUrl = rtrim($channel->store_url, '/').'/wp-json/wc/v3';

        $wooCategoryMap = $this->fetchAllWooCategories(
            $baseUrl,
            $credential->consumer_key,
            $credential->consumer_secret,
        );

        $imported = 0;
        $createdProducts = 0;
        $createdMappings = 0;
        $failed = 0;
        $errors = [];
        $page = 1;
        $productsUrl = $baseUrl.'/products';

        while (true) {
            try {
                $response = Http::withBasicAuth($credential->consumer_key, $credential->consumer_secret)
                    ->timeout(self::TIMEOUT)
                    ->get($productsUrl, ['per_page' => self::PER_PAGE, 'page' => $page, 'status' => 'any']);

                if (! $response->successful()) {
                    $errors[] = "Failed to fetch page {$page}: HTTP {$response->status()}.";
                    break;
                }

                /** @var list<array<string, mixed>> $wooProducts */
                $wooProducts = $response->json() ?? [];

                if (empty($wooProducts)) {
                    break;
                }

                foreach ($wooProducts as $wooProduct) {
                    $sku = trim((string) ($wooProduct['sku'] ?? ''));

                    if ($sku === '') {
                        $failed++;
                        $errors[] = sprintf('Product #%s skipped: no SKU.', $wooProduct['id'] ?? '?');

                        continue;
                    }

                    $imported++;

                    try {
                        [$product, $wasCreated] = $this->resolveProduct(
                            $sku,
                            $wooProduct,
                            $wooCategoryMap,
                            $defaultCategory->id,
                            $defaultUnit->id,
                            $channel,
                        );

                        if ($wasCreated) {
                            $createdProducts++;
                        }

                        if ($this->resolveMapping($product, $channel, $wooProduct)) {
                            $createdMappings++;
                        }
                    } catch (Throwable $e) {
                        $failed++;
                        $imported--;
                        $errors[] = "Failed to process SKU [{$sku}]: {$e->getMessage()}";
                    }
                }

                $totalPages = max(1, (int) ($response->header('X-WP-TotalPages') ?: 1));

                if ($page >= $totalPages || count($wooProducts) < self::PER_PAGE) {
                    break;
                }

                $page++;
            } catch (Throwable $e) {
                $errors[] = "Request error on page {$page}: {$e->getMessage()}";
                break;
            }
        }

        return new ImportResultDTO(
            $imported,
            $createdProducts,
            $createdMappings,
            $failed,
            $this->categoriesCreated,
            $this->categoriesUpdated,
            $errors,
        );
    }

    /**
     * Fetch all WooCommerce categories in one paginated pass.
     *
     * @return array<int, array<string, mixed>> keyed by WooCommerce category ID
     */
    private function fetchAllWooCategories(string $baseUrl, string $key, string $secret): array
    {
        $categories = [];
        $page = 1;
        $url = $baseUrl.'/products/categories';

        while (true) {
            try {
                $response = Http::withBasicAuth($key, $secret)
                    ->timeout(self::TIMEOUT)
                    ->get($url, ['per_page' => 100, 'page' => $page]);

                if (! $response->successful()) {
                    break;
                }

                /** @var list<array<string, mixed>> $batch */
                $batch = $response->json() ?? [];

                if (empty($batch)) {
                    break;
                }

                foreach ($batch as $cat) {
                    $id = (int) ($cat['id'] ?? 0);
                    if ($id > 0) {
                        $categories[$id] = $cat;
                    }
                }

                $totalPages = max(1, (int) ($response->header('X-WP-TotalPages') ?: 1));

                if ($page >= $totalPages || count($batch) < 100) {
                    break;
                }

                $page++;
            } catch (Throwable) {
                break;
            }
        }

        return $categories;
    }

    /**
     * Find or update existing product by SKU, or create a new one.
     * Updates: name, enrichment fields, category_id.
     * Preserves: unit_id, product_type, barcode, description (internal).
     *
     * @param  array<string, mixed>  $wooProduct
     * @param  array<int, array<string, mixed>>  $wooCategoryMap
     * @return array{Product, bool}
     */
    private function resolveProduct(
        string $sku,
        array $wooProduct,
        array $wooCategoryMap,
        string $defaultCategoryId,
        string $defaultUnitId,
        Channel $channel,
    ): array {
        $enrichment = $this->extractEnrichment($wooProduct);
        $categoryId = $this->resolveDeepestEcosCategory(
            $wooProduct['categories'] ?? [],
            $wooCategoryMap,
            $defaultCategoryId,
        );

        $existing = Product::query()->where('sku', $sku)->first();

        if ($existing !== null) {
            $existing->update(array_merge($enrichment, [
                'name' => (string) ($wooProduct['name'] ?? $existing->name),
                'category_id' => $categoryId,
            ]));

            return [$existing, false];
        }

        $isActive = (($wooProduct['status'] ?? '') === 'publish');

        $product = Product::query()->create(array_merge([
            'sku' => $sku,
            'name' => (string) ($wooProduct['name'] ?? $sku),
            'description' => $enrichment['long_description'],
            'category_id' => $categoryId,
            'unit_id' => $defaultUnitId,
            'product_type' => Product::TYPE_FINISHED_GOOD,
            'is_active' => $isActive,
            // ADR-013 Principle 8 / TASK-PRODUCT-OWNERSHIP-002:
            // Brand is the direct owner; channel.brand_id is always set (non-nullable after TASK-ADMIN-005).
            'brand_id' => $channel->brand_id,
        ], $enrichment));

        return [$product, true];
    }

    /**
     * Create or restore a product-channel mapping.
     * Returns true if a mapping was created/restored, false if it already existed.
     *
     * @param  array<string, mixed>  $wooProduct
     */
    private function resolveMapping(Product $product, Channel $channel, array $wooProduct): bool
    {
        $existing = ProductMapping::withTrashed()
            ->where('product_id', $product->id)
            ->where('channel_id', $channel->id)
            ->first();

        $attributes = [
            'external_product_id' => (string) ($wooProduct['id'] ?? ''),
            'external_sku' => (string) ($wooProduct['sku'] ?? ''),
            'sync_status' => SyncStatus::Synced->value,
            'last_sync_at' => now(),
        ];

        if ($existing !== null) {
            if ($existing->trashed()) {
                $existing->restore();
                $existing->update($attributes);

                return true;
            }

            return false;
        }

        ProductMapping::query()->create(array_merge($attributes, [
            'product_id' => $product->id,
            'channel_id' => $channel->id,
        ]));

        return true;
    }

    /**
     * Resolve the ECOS category ID for the deepest WooCommerce category,
     * creating the full ancestor hierarchy as needed.
     *
     * @param  list<array<string, mixed>>  $wooProductCategories
     * @param  array<int, array<string, mixed>>  $wooCategoryMap
     */
    private function resolveDeepestEcosCategory(
        array $wooProductCategories,
        array $wooCategoryMap,
        string $defaultCategoryId,
    ): string {
        if (empty($wooProductCategories)) {
            return $defaultCategoryId;
        }

        $deepestId = $this->findDeepestCategoryId($wooProductCategories, $wooCategoryMap);

        if ($deepestId === null || ! isset($wooCategoryMap[$deepestId])) {
            return $defaultCategoryId;
        }

        $chain = $this->buildAncestryChain($deepestId, $wooCategoryMap);

        if (empty($chain)) {
            return $defaultCategoryId;
        }

        return $this->resolveEcosCategoryChain($chain, $wooCategoryMap, $defaultCategoryId);
    }

    /**
     * Find the deepest category among a product's WooCommerce categories.
     * A category is "deepest" if none of the other product categories is its child.
     *
     * @param  list<array<string, mixed>>  $wooProductCategories
     * @param  array<int, array<string, mixed>>  $wooCategoryMap
     */
    private function findDeepestCategoryId(array $wooProductCategories, array $wooCategoryMap): ?int
    {
        $productIds = array_map(
            fn (array $c): int => (int) ($c['id'] ?? 0),
            $wooProductCategories,
        );

        foreach ($wooProductCategories as $cat) {
            $catId = (int) ($cat['id'] ?? 0);
            $isParent = false;

            foreach ($productIds as $otherId) {
                if ($otherId === $catId) {
                    continue;
                }

                // Walk up the ancestry of $otherId; if we reach $catId it means $catId is an ancestor
                $current = $otherId;
                $visited = [];
                while ($current > 0 && isset($wooCategoryMap[$current]) && ! in_array($current, $visited, true)) {
                    $visited[] = $current;
                    $parentId = (int) ($wooCategoryMap[$current]['parent'] ?? 0);
                    if ($parentId === $catId) {
                        $isParent = true;
                        break 2;
                    }
                    $current = $parentId;
                }
            }

            if (! $isParent) {
                return $catId;
            }
        }

        // Fallback: pick the category with the greatest depth in the hierarchy
        $maxDepth = -1;
        $deepestId = (int) ($wooProductCategories[0]['id'] ?? 0);

        foreach ($wooProductCategories as $cat) {
            $catId = (int) ($cat['id'] ?? 0);
            $depth = $this->wooCategoryDepth($catId, $wooCategoryMap);

            if ($depth > $maxDepth) {
                $maxDepth = $depth;
                $deepestId = $catId;
            }
        }

        return $deepestId > 0 ? $deepestId : null;
    }

    /**
     * Calculate the depth of a WooCommerce category (root = 0).
     *
     * @param  array<int, array<string, mixed>>  $wooCategoryMap
     */
    private function wooCategoryDepth(int $wooCatId, array $wooCategoryMap): int
    {
        $depth = 0;
        $current = $wooCatId;
        $visited = [];

        while ($current > 0 && isset($wooCategoryMap[$current]) && ! in_array($current, $visited, true)) {
            $visited[] = $current;
            $parent = (int) ($wooCategoryMap[$current]['parent'] ?? 0);
            if ($parent === 0) {
                break;
            }
            $depth++;
            $current = $parent;
        }

        return $depth;
    }

    /**
     * Build ancestry chain from root to leaf, clamped to MAX_CATEGORY_DEPTH levels.
     *
     * @param  array<int, array<string, mixed>>  $wooCategoryMap
     * @return list<int> WooCommerce category IDs ordered root → leaf
     */
    private function buildAncestryChain(int $wooCatId, array $wooCategoryMap): array
    {
        $chain = [];
        $current = $wooCatId;
        $visited = [];

        while ($current > 0 && isset($wooCategoryMap[$current]) && ! in_array($current, $visited, true)) {
            array_unshift($chain, $current);
            $visited[] = $current;
            $current = (int) ($wooCategoryMap[$current]['parent'] ?? 0);
        }

        if (count($chain) > self::MAX_CATEGORY_DEPTH) {
            $chain = array_slice($chain, -self::MAX_CATEGORY_DEPTH);
        }

        return array_values($chain);
    }

    /**
     * Ensure the full ancestry chain exists in ECOS and return the deepest ECOS category ID.
     * Creates missing categories, updates names of existing ones if changed.
     *
     * @param  list<int>  $chain  WooCommerce IDs ordered root → leaf
     * @param  array<int, array<string, mixed>>  $wooCategoryMap
     */
    private function resolveEcosCategoryChain(
        array $chain,
        array $wooCategoryMap,
        string $defaultCategoryId,
    ): string {
        $parentEcosId = null;
        $lastId = $defaultCategoryId;
        $level = 1;

        foreach ($chain as $wooId) {
            $wooCat = $wooCategoryMap[$wooId] ?? null;
            if ($wooCat === null) {
                continue;
            }

            $slug = trim((string) ($wooCat['slug'] ?? ''));
            $name = trim((string) ($wooCat['name'] ?? ''));

            if ($slug === '' || $name === '') {
                continue;
            }

            // Match by slug under the same parent to preserve hierarchy
            $existing = Category::query()
                ->where('code', $slug)
                ->where('parent_id', $parentEcosId)
                ->first();

            if ($existing !== null) {
                if ($existing->name !== $name) {
                    $existing->update(['name' => $name]);
                    $this->categoriesUpdated++;
                }

                $parentEcosId = $existing->id;
                $lastId = $existing->id;
                $level++;

                continue;
            }

            // Deduplicate code if the same slug exists under a different parent
            $code = $slug;
            $suffix = 1;
            while (Category::query()->where('code', $code)->exists()) {
                $code = $slug.'-'.$suffix;
                $suffix++;
            }

            $category = Category::query()->create([
                'code' => $code,
                'name' => $name,
                'parent_id' => $parentEcosId,
                'level' => $level,
                'sort_order' => 0,
                'is_active' => true,
            ]);

            $this->categoriesCreated++;
            $parentEcosId = $category->id;
            $lastId = $category->id;
            $level++;
        }

        return $lastId;
    }

    /**
     * Extract enrichment fields from a WooCommerce product payload.
     *
     * @param  array<string, mixed>  $wooProduct
     * @return array<string, mixed>
     */
    private function extractEnrichment(array $wooProduct): array
    {
        $images = $wooProduct['images'] ?? [];
        $imageUrl = isset($images[0]['src']) ? (string) $images[0]['src'] : null;

        $regularPriceRaw = $wooProduct['regular_price'] ?? '';
        $regularPrice = is_numeric($regularPriceRaw) ? (float) $regularPriceRaw : null;

        $salePriceRaw = $wooProduct['sale_price'] ?? '';
        $salePrice = is_numeric($salePriceRaw) && $salePriceRaw !== '' ? (float) $salePriceRaw : null;

        $shortDescription = strip_tags((string) ($wooProduct['short_description'] ?? ''));
        $longDescription = strip_tags((string) ($wooProduct['description'] ?? ''));

        $wooStockStatus = (string) ($wooProduct['stock_status'] ?? 'instock');
        $stockStatus = in_array($wooStockStatus, self::VALID_STOCK_STATUSES, true)
            ? $wooStockStatus
            : 'instock';

        return [
            'image_url' => $imageUrl !== '' ? $imageUrl : null,
            'regular_price' => $regularPrice,
            'sale_price' => $salePrice,
            'short_description' => $shortDescription !== '' ? $shortDescription : null,
            'long_description' => $longDescription !== '' ? $longDescription : null,
            'stock_status' => $stockStatus,
        ];
    }
}
