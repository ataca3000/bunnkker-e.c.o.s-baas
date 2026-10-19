<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\Organization\Branches\Domain\Contracts\BranchRepositoryInterface;
use Modules\Organization\Branches\Domain\Models\Branch;

/**
 * Eloquent implementation of the branch repository.
 */
final class EloquentBranchRepository implements BranchRepositoryInterface
{
    /** Columns that may be sorted on (whitelist). */
    private const SORTABLE = ['code', 'name', 'city', 'is_head_office', 'is_active', 'created_at'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = Branch::query()->with(['company', 'defaultWarehouse']);

        $companyId = trim((string) ($filters['company_id'] ?? ''));
        if ($companyId !== '') {
            $query->where('company_id', $companyId);
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where('code', 'ilike', "%{$search}%")
                    ->orWhere('name', 'ilike', "%{$search}%")
                    ->orWhere('manager_name', 'ilike', "%{$search}%")
                    ->orWhere('city', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%");
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

    public function findById(string $id): ?Branch
    {
        return Branch::query()->with(['company', 'defaultWarehouse'])->find($id);
    }

    public function create(array $attributes): Branch
    {
        $branch = Branch::query()->create($attributes);

        return $branch->load(['company', 'defaultWarehouse']);
    }

    public function update(Branch $branch, array $attributes): Branch
    {
        $branch->update($attributes);

        return $branch->load(['company', 'defaultWarehouse']);
    }

    public function delete(Branch $branch): void
    {
        $branch->delete();
    }

    public function headOfficeExists(string $companyId, ?string $exceptBranchId = null): bool
    {
        return Branch::query()
            ->where('company_id', $companyId)
            ->where('is_head_office', true)
            ->when($exceptBranchId !== null, fn (Builder $query) => $query->whereKeyNot($exceptBranchId))
            ->exists();
    }
}
