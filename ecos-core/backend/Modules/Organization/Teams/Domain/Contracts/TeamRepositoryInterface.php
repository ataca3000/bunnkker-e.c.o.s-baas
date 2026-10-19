<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Organization\Teams\Domain\Models\Team;

interface TeamRepositoryInterface
{
    /** @param array<string, mixed> $filters */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?Team;

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Team;

    /** @param array<string, mixed> $attributes */
    public function update(Team $team, array $attributes): Team;

    public function delete(Team $team): void;

    public function nextCodeNumber(string $companyId): int;
}
