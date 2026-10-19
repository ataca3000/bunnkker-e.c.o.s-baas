<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Domain\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Sales\Customers\Domain\Models\Customer;

interface CustomerRepositoryInterface
{
    public function paginate(array $filters): LengthAwarePaginator;

    public function findById(string $id): ?Customer;

    public function create(array $attributes): Customer;

    public function update(Customer $customer, array $attributes): Customer;

    public function delete(Customer $customer): void;
}
