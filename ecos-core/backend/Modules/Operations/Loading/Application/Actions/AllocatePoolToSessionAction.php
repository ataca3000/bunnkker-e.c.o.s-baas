<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Modules\Operations\Loading\Application\Services\AutoAllocationService;
use Modules\Operations\Loading\Domain\Models\LoadingSession;

/**
 * Thin orchestrator: drives auto-allocation of pool inventory for a loading session.
 *
 * Called by StartAllocationAction immediately after the session transitions to
 * the Allocating status. Delegates all logic to AutoAllocationService.
 */
final class AllocatePoolToSessionAction
{
    public function __construct(
        private readonly AutoAllocationService $autoAllocation,
    ) {}

    /**
     * @return array{records_created:int,partial_count:int,skipped_count:int,orders_allocated:int}
     */
    public function execute(LoadingSession $session, string $actorId): array
    {
        return $this->autoAllocation->allocateSession($session, $actorId);
    }
}
