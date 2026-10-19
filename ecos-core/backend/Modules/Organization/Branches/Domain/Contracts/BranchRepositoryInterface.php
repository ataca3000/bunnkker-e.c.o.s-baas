<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Organization\Branches\Domain\Models\Branch;

/**
 * Persistence port for branches. Implemented by the Infrastructure layer.
 */
interface BranchRepositoryInterface
{
    /**
     * Paginate branches applying company / status filters, search and sorting.
     *
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Branch>
     */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?Branch;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function create(array $attributes): Branch;

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function update(Branch $branch, array $attributes): Branch;

    public function delete(Branch $branch): void;

    /**
     * Whether the company already has a head-office branch.
     *
     * @param  string|null  $exceptBranchId  Ignore this branch (used on update).
     */
    public function headOfficeExists(string $companyId, ?string $exceptBranchId = null): bool;
}
