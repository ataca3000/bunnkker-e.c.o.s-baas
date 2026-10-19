<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Organization\Brands\Domain\Models\Brand;

interface BrandRepositoryInterface
{
    /** @param array<string, mixed> $filters */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?Brand;

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Brand;

    /** @param array<string, mixed> $attributes */
    public function update(Brand $brand, array $attributes): Brand;

    public function delete(Brand $brand): void;

    public function nextCodeNumber(string $companyId): int;

    public function existsBySlug(string $companyId, string $slug, ?string $exceptId = null): bool;
}
