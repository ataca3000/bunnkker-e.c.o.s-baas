<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Contracts;

use Illuminate\Pagination\LengthAwarePaginator;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;

/**
 * Persistence boundary for the Vehicle aggregate.
 *
 * The service layer depends on this contract rather than Eloquent, so query
 * construction stays in one place and the aggregate can be re-hosted without
 * touching business logic.
 */
interface VehicleRepositoryInterface
{
    public function findById(int $id): ?Vehicle;

    public function findByIdOrFail(int $id): Vehicle;

    public function findByUuid(string $uuid): ?Vehicle;

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, Vehicle>
     */
    public function paginate(array $filters = [], int $perPage = 20): LengthAwarePaginator;

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): Vehicle;

    /** @param array<string, mixed> $attributes */
    public function update(Vehicle $vehicle, array $attributes): Vehicle;

    /** Dashboard counters, resolved in a single pass per metric. */
    public function statistics(): array;

    /** Next sequential vehicle code, e.g. VEH-004. */
    public function nextCode(): string;
}
