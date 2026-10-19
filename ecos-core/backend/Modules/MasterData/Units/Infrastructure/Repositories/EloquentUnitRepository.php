<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\MasterData\Units\Domain\Contracts\UnitRepositoryInterface;
use Modules\MasterData\Units\Domain\Models\Unit;

/**
 * Eloquent implementation of the unit repository.
 */
final class EloquentUnitRepository implements UnitRepositoryInterface
{
    /** Columns that may be sorted on (whitelist). */
    private const SORTABLE = ['code', 'name', 'symbol', 'is_active', 'created_at'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = Unit::query();

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('symbol', 'like', "%{$search}%");
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

    public function findById(string $id): ?Unit
    {
        return Unit::query()->find($id);
    }

    public function create(array $attributes): Unit
    {
        return Unit::query()->create($attributes);
    }

    public function update(Unit $unit, array $attributes): Unit
    {
        $unit->update($attributes);

        return $unit->refresh();
    }

    public function delete(Unit $unit): void
    {
        $unit->delete();
    }
}
