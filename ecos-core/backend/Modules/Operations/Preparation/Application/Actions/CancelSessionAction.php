<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\FeatureFlags\FeatureFlagService;
use Modules\Operations\Preparation\Domain\Enums\SessionStatus;
use Modules\Operations\Preparation\Domain\Events\SessionCancelled;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;
use RuntimeException;

final class CancelSessionAction
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    public function execute(PreparationSession $session, string $actorId, string $reason): PreparationSession
    {
        $this->guardWorkflowStage($session->company_id);

        if (! $session->status->canTransitionTo(SessionStatus::Cancelled)) {
            throw new RuntimeException(
                "Cannot cancel session in status [{$session->status->value}].",
            );
        }

        $session->update([
            'status' => SessionStatus::Cancelled->value,
            'cancelled_at' => now(),
            'cancelled_by' => $actorId,
            'cancellation_reason' => $reason,
            'updated_by' => $actorId,
        ]);

        event(new SessionCancelled($session, $actorId, $reason));

        return $session->refresh();
    }

    private function guardWorkflowStage(string $companyId): void
    {
        if (! $this->flags->isEnabled('workflow.stages.preparation', $companyId)) {
            throw new RuntimeException('Preparation OS workflow stage is not enabled.');
        }
    }
}
