<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Purchasing\PurchaseMaterials\Domain\Models\PurchaseMaterial;

interface PurchaseMaterialRepositoryInterface
{
    /** @param array<string, mixed> $filters */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?PurchaseMaterial;

    /** @param array<string, mixed> $attributes @param list<array<string, mixed>> $lines */
    public function create(array $attributes, array $lines): PurchaseMaterial;

    /** @param array<string, mixed> $attributes @param list<array<string, mixed>> $lines */
    public function update(PurchaseMaterial $material, array $attributes, array $lines): PurchaseMaterial;

    public function delete(PurchaseMaterial $material): void;

    public function nextRequestNumber(): string;
}
