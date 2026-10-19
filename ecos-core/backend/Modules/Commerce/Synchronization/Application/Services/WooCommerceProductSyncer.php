<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Services;

use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\ProductMappings\Domain\Enums\SyncStatus as MappingSyncStatus;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Handles inbound WooCommerce → ECOS product synchronization.
 *
 * Design constraints:
 * - We cannot create products from WooCommerce because ECOS requires category_id and unit_id,
 *   which are ERP-specific and not present in WooCommerce payloads.
 * - product.created: match by SKU; if no match, log as skipped (cannot auto-create).
 * - product.updated: match by SKU; if match, update name/description/prices; also maintain
 *   the ProductMapping with the WooCommerce product ID.
 * - product.deleted: match by SKU; if match, set is_active = false (soft-deactivate).
 */
final class WooCommerceProductSyncer
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{action: string, product_id: string|null}
     */
    public function syncCreated(Channel $channel, array $payload): array
    {
        $sku = trim((string) ($payload['sku'] ?? ''));

        if ($sku === '') {
            return ['action' => 'skipped_no_sku', 'product_id' => null];
        }

        $product = Product::withoutEvents(function () use ($sku): ?Product {
            return Product::query()->where('sku', $sku)->first();
        });

        if ($product === null) {
            return ['action' => 'skipped_no_sku_match', 'product_id' => null];
        }

        $externalId = (string) ($payload['id'] ?? '');
        $this->upsertMapping($channel, $product, $externalId);
        $this->applyProductFields($product, $payload);

        return ['action' => 'mapping_created', 'product_id' => $product->id];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{action: string, product_id: string|null}
     */
    public function syncUpdated(Channel $channel, array $payload): array
    {
        $sku = trim((string) ($payload['sku'] ?? ''));

        if ($sku === '') {
            return ['action' => 'skipped_no_sku', 'product_id' => null];
        }

        $product = Product::withoutEvents(function () use ($sku): ?Product {
            return Product::query()->where('sku', $sku)->first();
        });

        if ($product === null) {
            return ['action' => 'skipped_no_sku_match', 'product_id' => null];
        }

        $externalId = (string) ($payload['id'] ?? '');
        $this->upsertMapping($channel, $product, $externalId);
        $this->applyProductFields($product, $payload);

        return ['action' => 'updated', 'product_id' => $product->id];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{action: string, product_id: string|null}
     */
    public function syncDeleted(Channel $channel, array $payload): array
    {
        $sku = trim((string) ($payload['sku'] ?? ''));
        $externalId = (string) ($payload['id'] ?? '');

        $product = null;

        if ($sku !== '') {
            $product = Product::withoutEvents(function () use ($sku): ?Product {
                return Product::query()->where('sku', $sku)->first();
            });
        }

        if ($product === null && $externalId !== '') {
            $mapping = ProductMapping::query()
                ->where('channel_id', $channel->id)
                ->where('external_product_id', $externalId)
                ->first();

            $product = $mapping?->product;
        }

        if ($product === null) {
            return ['action' => 'skipped_not_found', 'product_id' => null];
        }

        Product::withoutEvents(function () use ($product): void {
            $product->update(['is_active' => false]);
        });

        return ['action' => 'deactivated', 'product_id' => $product->id];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function applyProductFields(Product $product, array $payload): void
    {
        $updates = [];

        $name = trim((string) ($payload['name'] ?? ''));
        if ($name !== '') {
            $updates['name'] = $name;
        }

        $description = trim(strip_tags((string) ($payload['description'] ?? '')));
        if ($description !== '') {
            $updates['description'] = $description;
        }

        $shortDescription = trim(strip_tags((string) ($payload['short_description'] ?? '')));
        if ($shortDescription !== '') {
            $updates['short_description'] = $shortDescription;
        }

        $regularPrice = $payload['regular_price'] ?? '';
        if ($regularPrice !== '' && $regularPrice !== null) {
            $updates['regular_price'] = (float) $regularPrice;
        }

        $salePrice = $payload['sale_price'] ?? '';
        if ($salePrice !== '' && $salePrice !== null) {
            $updates['sale_price'] = (float) $salePrice;
        }

        if ($updates !== []) {
            Product::withoutEvents(function () use ($product, $updates): void {
                $product->update($updates);
            });
        }
    }

    private function upsertMapping(Channel $channel, Product $product, string $externalId): void
    {
        if ($externalId === '') {
            return;
        }

        ProductMapping::query()->updateOrCreate(
            ['channel_id' => $channel->id, 'product_id' => $product->id],
            ['external_product_id' => $externalId, 'sync_status' => MappingSyncStatus::Synced->value],
        );
    }
}
