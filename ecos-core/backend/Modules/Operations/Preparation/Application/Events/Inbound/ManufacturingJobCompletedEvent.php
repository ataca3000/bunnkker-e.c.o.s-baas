<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Events\Inbound;

/**
 * Integration contract event: fired by Manufacturing OS when a production job finishes.
 * Preparation OS updates ProductionRequirement.status → ready.
 *
 * Source: Manufacturing OS (INTEGRATION-DESIGN.md §13)
 */
final class ManufacturingJobCompletedEvent
{
    public function __construct(
        public readonly string $jobId,
        public readonly string $productId,
        public readonly float $quantityProduced,
    ) {}
}
