<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services\WaveEngine;

use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

final class WaveManager
{
    /** @var list<string> */
    private const ACTIVE_STATUSES = [
        WaveStatus::Collecting->value,
        WaveStatus::Preparing->value,
    ];

    public function getActiveWave(string $companyId, string $warehouseId): ?PreparationWave
    {
        return PreparationWave::where('company_id', $companyId)
            ->where('warehouse_id', $warehouseId)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->first();
    }

    public function getActiveWaveForDate(string $companyId, string $warehouseId, string $date): ?PreparationWave
    {
        return PreparationWave::where('company_id', $companyId)
            ->where('warehouse_id', $warehouseId)
            ->where('planning_date', $date)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->first();
    }

    public function hasActiveWave(string $companyId, string $warehouseId): bool
    {
        return PreparationWave::where('company_id', $companyId)
            ->where('warehouse_id', $warehouseId)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->exists();
    }

    public function getCollectingWave(string $companyId, string $warehouseId): ?PreparationWave
    {
        return PreparationWave::where('company_id', $companyId)
            ->where('warehouse_id', $warehouseId)
            ->where('status', WaveStatus::Collecting->value)
            ->first();
    }

    public function getPreparingWave(string $companyId, string $warehouseId): ?PreparationWave
    {
        return PreparationWave::where('company_id', $companyId)
            ->where('warehouse_id', $warehouseId)
            ->where('status', WaveStatus::Preparing->value)
            ->first();
    }
}
