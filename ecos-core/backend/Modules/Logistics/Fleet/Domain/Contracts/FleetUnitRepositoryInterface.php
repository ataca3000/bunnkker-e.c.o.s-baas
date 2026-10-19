<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Contracts;

use Illuminate\Pagination\LengthAwarePaginator;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;

interface FleetUnitRepositoryInterface
{
    public function findByUuid(string $uuid): ?FleetUnit;

    public function findByUuidOrFail(string $uuid): FleetUnit;

    public function findByVehicleId(int $vehicleId): ?FleetUnit;

    /** @param array<string, mixed> $filters */
    public function paginate(array $filters = [], int $perPage = 20): LengthAwarePaginator;

    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): FleetUnit;

    /** @param array<string, mixed> $attributes */
    public function update(FleetUnit $unit, array $attributes): FleetUnit;

    /** @return array<string, mixed> */
    public function statistics(?string $companyId = null): array;

    /**
     * Units whose maintenance is past due beyond grace — the overdue sweep.
     *
     * @return list<FleetUnit>
     */
    public function unitsWithOverdueMaintenance(?string $companyId = null): array;
}
