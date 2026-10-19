<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\FeatureFlags\FeatureFlagService;
use Modules\Operations\Preparation\Domain\Enums\SessionStatus;
use Modules\Operations\Preparation\Domain\Events\SessionStarted;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;
use RuntimeException;

final class StartSessionAction
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    public function execute(PreparationSession $session, string $actorId): PreparationSession
    {
        $this->guardWorkflowStage($session->company_id);

        if (! $session->status->canTransitionTo(SessionStatus::InProgress)) {
            throw new RuntimeException(
                "Cannot start session in status [{$session->status->value}].",
            );
        }

        $session->update([
            'status' => SessionStatus::InProgress->value,
            'started_at' => now(),
            'started_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        event(new SessionStarted($session, $actorId));

        return $session->refresh();
    }

    private function guardWorkflowStage(string $companyId): void
    {
        if (! $this->flags->isEnabled('workflow.stages.preparation', $companyId)) {
            throw new RuntimeException('Preparation OS workflow stage is not enabled.');
        }
    }
}
