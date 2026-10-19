<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Actions;

use Carbon\Carbon;
use Modules\Core\BusinessAttribution\Application\Services\EnhancedReplayService;
use Modules\Core\BusinessAttribution\Application\Services\ReplayAuditService;
use Modules\Core\BusinessAttribution\Application\Services\TimeMachineService;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\EntityState;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\ReplayContext;

class ResolveEntityAtTimeAction
{
    public function __construct(
        private readonly TimeMachineService $timeMachine,
        private readonly ReplayAuditService $auditService,
        private readonly EnhancedReplayService $replayService,
    ) {}

    public function execute(
        string $entityType,
        string $entityId,
        Carbon $asOf,
        string $purpose = 'Time Machine',
        ?string $userId = null,
    ): EntityState {
        $context = ReplayContext::atTime($entityType, $entityId, $asOf)
            ->withPurpose($purpose);

        if ($userId) {
            $context = $context->withUser($userId);
        }

        // Replay events for the audit record
        $replayResult = $this->replayService->replayWithContext($context);

        // Reconstruct state by applying each event in order
        $state = $this->timeMachine->resolveAt($entityType, $entityId, $asOf);

        $this->auditService->log(
            context: $context,
            result: $replayResult,
            status: 'completed',
            userId: $userId,
        );

        return $state;
    }
}
