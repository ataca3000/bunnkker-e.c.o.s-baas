<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Commerce\Orders\Domain\Models\Order;

interface OrderRepositoryInterface
{
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?Order;

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function create(array $attributes, array $lines): Order;

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function update(Order $order, array $attributes, array $lines): Order;

    public function delete(Order $order): void;

    public function nextOrderNumber(): string;

    /** @return list<string> */
    public function listPaymentMethods(string $companyId): array;

    /** @return list<string> */
    public function listShippingCompanies(string $companyId): array;
}
