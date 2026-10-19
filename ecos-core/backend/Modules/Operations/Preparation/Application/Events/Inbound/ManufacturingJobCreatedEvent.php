<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Events\Inbound;

/**
 * Integration contract event: fired by Manufacturing OS when a production job is created.
 * Preparation OS updates the linked ProductionRequirement with the manufacturing_job_id.
 *
 * Source: Manufacturing OS (when implemented, will fire this class or an equivalent)
 * INTEGRATION-DESIGN.md §13
 */
final class ManufacturingJobCreatedEvent
{
    public function __construct(
        public readonly string $requestWaveId,
        public readonly string $productId,
        public readonly string $jobId,
    ) {}
}
