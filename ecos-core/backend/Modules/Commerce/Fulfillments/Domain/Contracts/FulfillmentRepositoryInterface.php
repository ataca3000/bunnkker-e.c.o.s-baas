<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Commerce\Fulfillments\Domain\Models\Fulfillment;

interface FulfillmentRepositoryInterface
{
    /** @param array<string, mixed> $filters */
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?Fulfillment;

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function create(array $attributes, array $lines): Fulfillment;

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function update(Fulfillment $fulfillment, array $attributes, array $lines): Fulfillment;

    public function delete(Fulfillment $fulfillment): void;

    public function nextFulfillmentNumber(): string;
}
