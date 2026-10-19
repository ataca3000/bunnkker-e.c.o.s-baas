<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Organization\BusinessAccounts\Domain\Models\BusinessAccount;

interface BusinessAccountRepositoryInterface
{
    /** @param array<string, mixed> $filters */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?BusinessAccount;

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): BusinessAccount;

    /** @param array<string, mixed> $attributes */
    public function update(BusinessAccount $account, array $attributes): BusinessAccount;

    public function delete(BusinessAccount $account): void;

    public function nextCodeNumber(string $companyId): int;
}
