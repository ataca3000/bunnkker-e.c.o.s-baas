<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Domain\Contracts;

use Illuminate\Pagination\LengthAwarePaginator;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;

interface BomRepositoryInterface
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?BillOfMaterial;

    /**
     * @param  array<string, mixed>  $attributes
     * @param  list<array<string, mixed>>  $lines
     */
    public function create(array $attributes, array $lines): BillOfMaterial;

    /**
     * @param  array<string, mixed>  $attributes
     * @param  list<array<string, mixed>>  $lines
     */
    public function update(BillOfMaterial $bom, array $attributes, ?array $lines): BillOfMaterial;

    public function delete(BillOfMaterial $bom): void;

    public function nextBomNumber(): string;

    public function nextVersionNumber(string $productId): int;
}
