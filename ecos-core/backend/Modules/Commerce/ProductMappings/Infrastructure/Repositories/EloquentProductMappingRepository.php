<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Commerce\ProductMappings\Domain\Contracts\ProductMappingRepositoryInterface;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;

final class EloquentProductMappingRepository implements ProductMappingRepositoryInterface
{
    private const SORTABLE = ['external_product_id', 'external_sku', 'sync_status', 'last_sync_at', 'created_at'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = ProductMapping::query()->with(['product', 'channel']);

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder
                    ->where('external_product_id', 'like', "%{$search}%")
                    ->orWhere('external_sku', 'like', "%{$search}%");
            });
        }

        $productId = trim((string) ($filters['product_id'] ?? ''));
        if ($productId !== '') {
            $query->where('product_id', $productId);
        }

        $channelId = trim((string) ($filters['channel_id'] ?? ''));
        if ($channelId !== '') {
            $query->where('channel_id', $channelId);
        }

        $syncStatus = trim((string) ($filters['sync_status'] ?? ''));
        if ($syncStatus !== '') {
            $query->where('sync_status', $syncStatus);
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        if (! in_array($sortBy, self::SORTABLE, true)) {
            $sortBy = 'created_at';
        }

        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        $perPage = max(1, min((int) ($filters['per_page'] ?? 10), 100));

        return $query->orderBy($sortBy, $sortDir)->paginate($perPage);
    }

    public function findById(string $id): ?ProductMapping
    {
        return ProductMapping::query()->with(['product', 'channel'])->find($id);
    }

    public function create(array $attributes): ProductMapping
    {
        $mapping = ProductMapping::query()->create($attributes);

        return $mapping->load(['product', 'channel']);
    }

    public function update(ProductMapping $mapping, array $attributes): ProductMapping
    {
        $mapping->update($attributes);

        return $mapping->refresh()->load(['product', 'channel']);
    }

    public function delete(ProductMapping $mapping): void
    {
        $mapping->delete();
    }
}
