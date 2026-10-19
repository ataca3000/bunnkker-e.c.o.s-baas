<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Infrastructure\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\Organization\Companies\Domain\Contracts\CompanyRepositoryInterface;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * Eloquent implementation of the company repository.
 */
final class EloquentCompanyRepository implements CompanyRepositoryInterface
{
    /** Columns that may be sorted on (whitelist). */
    private const SORTABLE = ['code', 'name', 'currency', 'timezone', 'country', 'is_active', 'created_at', 'updated_at'];

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = Company::query()->withCount(['brands', 'warehouses', 'teams', 'businessAccounts']);

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where('code', 'ilike', "%{$search}%")
                    ->orWhere('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('country', 'ilike', "%{$search}%")
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

    public function findById(string $id): ?Company
    {
        return Company::query()->withCount(['brands', 'warehouses', 'teams', 'businessAccounts'])->find($id);
    }

    public function create(array $attributes): Company
    {
        return Company::query()->create($attributes);
    }

    public function update(Company $company, array $attributes): Company
    {
        $company->update($attributes);

        return $company->refresh();
    }

    public function delete(Company $company): void
    {
        $company->delete();
    }
}
