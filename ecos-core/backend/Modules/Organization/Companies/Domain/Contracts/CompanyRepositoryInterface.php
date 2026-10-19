<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * Persistence port for companies. Implemented by the Infrastructure layer.
 */
interface CompanyRepositoryInterface
{
    /**
     * Paginate companies applying search, status filter and sorting.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Company>
     */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?Company;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): Company;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Company $company, array $attributes): Company;

    public function delete(Company $company): void;
}
