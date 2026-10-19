<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\MasterData\Categories\Domain\Contracts\CategoryRepositoryInterface;
use Modules\MasterData\Categories\Domain\Models\Category;

/**
 * Eloquent implementation of the category repository.
 */
final class EloquentCategoryRepository implements CategoryRepositoryInterface
{
    /** Columns that may be sorted on (whitelist). */
    private const SORTABLE = ['code', 'name', 'level', 'sort_order', 'is_active', 'created_at'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = Category::query()->with('parent');

        $scope = trim((string) ($filters['scope'] ?? ''));
        if ($scope !== '') {
            $query->where('category_scope', $scope);
        }

        $parentId = trim((string) ($filters['parent_id'] ?? ''));
        if ($parentId !== '') {
            $query->where('parent_id', $parentId);
        }

        $level = $filters['level'] ?? null;
        if ($level !== null && $level !== '') {
            $query->where('level', (int) $level);
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
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

        $perPage = (int) ($filters['per_page'] ?? 10);
        $perPage = max(1, min($perPage, 100));

        return $query->orderBy($sortBy, $sortDir)->paginate($perPage);
    }

    public function findById(string $id): ?Category
    {
        return Category::query()->with('parent')->find($id);
    }

    public function create(array $attributes): Category
    {
        $category = Category::query()->create($attributes);

        return $category->load('parent');
    }

    public function update(Category $category, array $attributes): Category
    {
        $category->update($attributes);

        return $category->load('parent');
    }

    public function delete(Category $category): void
    {
        $category->delete();
    }
}
