<?php

declare(strict_types=1);

namespace Modules\Common\Snapshots\Domain\Contracts;

use Modules\Common\Snapshots\Domain\DTOs\BusinessContextDTO;
use Modules\Common\Snapshots\Domain\DTOs\FinancialSnapshotDTO;

/**
 * Persistence contract implemented by each consuming module.
 * The SnapshotManager calls this adapter without knowing which Eloquent models are involved.
 * Orders, POS, Procurement, etc. each provide their own implementation.
 */
interface SnapshotPersistenceAdapter
{
    /** True if a business context snapshot already exists for this aggregate. */
    public function businessContextExists(): bool;

    /** True if a financial snapshot already exists for this aggregate. */
    public function financialSnapshotExists(): bool;

    /** Persist the business context DTO to the module-specific table. */
    public function persistBusinessContext(BusinessContextDTO $dto, ?string $actorId): void;

    /** Persist the financial snapshot DTO (header + lines) to module-specific tables. */
    public function persistFinancialSnapshot(FinancialSnapshotDTO $dto, ?string $actorId): void;

    /** Append a timeline event to the module's event log. */
    public function logSnapshotEvent(string $type, string $description, array $metadata, ?string $actorId): void;
}
