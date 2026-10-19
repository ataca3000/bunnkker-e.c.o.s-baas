<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Contracts;

use Illuminate\Pagination\LengthAwarePaginator;
use Modules\Logistics\Delivery\Domain\Models\Delivery;

/**
 * Persistence boundary for the Delivery aggregate. The service layer depends
 * on this rather than Eloquent so query construction lives in one place.
 */
interface DeliveryRepositoryInterface
{
    public function findByUuid(string $uuid): ?Delivery;

    public function findByUuidOrFail(string $uuid): Delivery;

    public function findByOrderId(string $orderId): ?Delivery;

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Delivery>
     */
    public function paginate(array $filters = [], int $perPage = 20): LengthAwarePaginator;

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Delivery;

    /** @param array<string, mixed> $attributes */
    public function update(Delivery $delivery, array $attributes): Delivery;

    /** Dashboard counters. */
    public function statistics(?string $companyId = null): array;

    /** Deliveries past their promised time and still open. */
    public function breachedOpenDeliveries(?string $companyId = null): int;
}
