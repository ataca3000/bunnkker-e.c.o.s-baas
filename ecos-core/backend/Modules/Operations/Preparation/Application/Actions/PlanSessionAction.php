<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\FeatureFlags\FeatureFlagService;
use Modules\Operations\Preparation\Domain\Enums\SessionStatus;
use Modules\Operations\Preparation\Domain\Events\SessionPlanned;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;
use RuntimeException;

final class PlanSessionAction
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    public function execute(PreparationSession $session, string $actorId): PreparationSession
    {
        $this->guardWorkflowStage($session->company_id);

        if (! $session->status->canTransitionTo(SessionStatus::Planning)) {
            throw new RuntimeException(
                "Cannot move session [{$session->id}] to Planning from status [{$session->status->value}].",
            );
        }

        $session->update([
            'status' => SessionStatus::Planning->value,
            'planned_at' => now(),
            'planned_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        event(new SessionPlanned($session, $actorId));

        return $session->refresh();
    }

    private function guardWorkflowStage(string $companyId): void
    {
        if (! $this->flags->isEnabled('workflow.stages.preparation', $companyId)) {
            throw new RuntimeException('Preparation OS workflow stage is not enabled.');
        }
    }
}
