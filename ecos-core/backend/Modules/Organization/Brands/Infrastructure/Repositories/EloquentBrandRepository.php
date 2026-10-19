<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\Organization\Brands\Domain\Contracts\BrandRepositoryInterface;
use Modules\Organization\Brands\Domain\Models\Brand;

final class EloquentBrandRepository implements BrandRepositoryInterface
{
    private const SORTABLE = ['code', 'name', 'slug', 'is_active', 'created_at', 'updated_at'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = Brand::query()->with('company')->withCount([
            'channels',
            'channels as active_channels_count' => fn (Builder $q) => $q->where('is_active', true),
            'products',
        ]);

        $companyId = trim((string) ($filters['company_id'] ?? ''));
        if ($companyId !== '') {
            $query->where('company_id', $companyId);
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $b) use ($search): void {
                $b->where('code', 'ilike', "%{$search}%")
                    ->orWhere('name', 'ilike', "%{$search}%")
                    ->orWhere('slug', 'ilike', "%{$search}%")
                    ->orWhere('description', 'ilike', "%{$search}%");
            });
        }

        $status = (string) ($filters['status'] ?? 'all');
        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        if (! in_array($sortBy, self::SORTABLE, true)) {
            $sortBy = 'created_at';
        }

        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        $perPage = max(1, min((int) ($filters['per_page'] ?? 10), 100));

        return $query->orderBy($sortBy, $sortDir)->paginate($perPage);
    }

    public function findById(string $id): ?Brand
    {
        return Brand::query()->with('company')->withCount([
            'channels',
            'channels as active_channels_count' => fn (Builder $q) => $q->where('is_active', true),
            'products',
        ])->find($id);
    }

    public function create(array $attributes): Brand
    {
        return Brand::query()->create($attributes)->load('company');
    }

    public function update(Brand $brand, array $attributes): Brand
    {
        $brand->update($attributes);

        return $brand->load('company');
    }

    public function delete(Brand $brand): void
    {
        $brand->delete();
    }

    public function nextCodeNumber(string $companyId): int
    {
        // Lock the count inside a transaction to prevent concurrent duplicates
        $count = Brand::query()
            ->withTrashed()
            ->where('company_id', $companyId)
            ->lockForUpdate()
            ->count();

        return $count + 1;
    }

    public function existsBySlug(string $companyId, string $slug, ?string $exceptId = null): bool
    {
        return Brand::query()
            ->where('company_id', $companyId)
            ->where('slug', $slug)
            ->when($exceptId !== null, fn (Builder $q) => $q->whereKeyNot($exceptId))
            ->exists();
    }
}
