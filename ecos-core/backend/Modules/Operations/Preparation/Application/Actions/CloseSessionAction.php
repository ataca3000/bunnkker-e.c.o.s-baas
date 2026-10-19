<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\Audit\AuditService;
use App\Core\FeatureFlags\FeatureFlagService;
use App\Core\Timeline\TimelineService;
use Modules\Operations\Preparation\Domain\Enums\SessionStatus;
use Modules\Operations\Preparation\Domain\Events\SessionClosed;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;
use RuntimeException;

final class CloseSessionAction
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly TimelineService $timeline,
        private readonly FeatureFlagService $flags,
    ) {}

    public function execute(PreparationSession $session, string $actorId): PreparationSession
    {
        $this->guardWorkflowStage($session->company_id);

        if (! $session->status->canTransitionTo(SessionStatus::Closed)) {
            throw new RuntimeException(
                "Cannot close session [{$session->id}] from status [{$session->status->value}]. "
                .'Session must be in Approved status before closing.',
            );
        }

        $session->update([
            'status' => SessionStatus::Closed->value,
            'closed_at' => now(),
            'closed_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        event(new SessionClosed($session, $actorId));

        $this->timeline->record(
            companyId: $session->company_id,
            subjectType: 'PreparationSession',
            subjectId: $session->id,
            eventType: 'session.closed',
            title: "Session {$session->session_number} closed",
            description: 'Loading confirmed. Session archived.',
            actorId: (int) $actorId,
            sourceModule: 'Operations.Preparation',
        );

        $this->audit->record(
            action: 'preparation.session.closed',
            entityType: 'PreparationSession',
            entityId: $session->id,
            companyId: $session->company_id,
            userId: (int) $actorId,
            oldValues: ['status' => SessionStatus::Approved->value],
            newValues: ['status' => SessionStatus::Closed->value],
        );

        return $session->refresh();
    }

    private function guardWorkflowStage(string $companyId): void
    {
        if (! $this->flags->isEnabled('workflow.stages.preparation', $companyId)) {
            throw new RuntimeException('Preparation OS workflow stage is not enabled.');
        }
    }
}
