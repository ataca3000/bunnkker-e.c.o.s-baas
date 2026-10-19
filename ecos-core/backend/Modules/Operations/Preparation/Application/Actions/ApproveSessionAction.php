<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\Audit\AuditService;
use App\Core\FeatureFlags\FeatureFlagService;
use App\Core\Timeline\TimelineService;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Domain\Enums\SessionStatus;
use Modules\Operations\Preparation\Domain\Events\SessionApproved;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;
use Modules\Operations\Preparation\Domain\Models\PreparedProductsPool;
use RuntimeException;

final class ApproveSessionAction
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly TimelineService $timeline,
        private readonly FeatureFlagService $flags,
    ) {}

    public function execute(PreparationSession $session, string $actorId): PreparationSession
    {
        $this->guardWorkflowStage($session->company_id);

        if (! $session->status->canTransitionTo(SessionStatus::Approved)) {
            throw new RuntimeException(
                "Cannot approve session [{$session->id}] from status [{$session->status->value}]. "
                .'Session must be in Completed status before approval.',
            );
        }

        return DB::transaction(function () use ($session, $actorId): PreparationSession {
            $now = now();

            // Collect all wave IDs belonging to this session.
            $waveIds = $session->waves()->pluck('id')->toArray();

            // Open the shipping gate for all pool entries from this session's waves.
            // This makes pool stock available to Loading OS.
            $poolEntriesOpened = 0;
            if (! empty($waveIds)) {
                $poolEntriesOpened = PreparedProductsPool::whereIn('preparation_wave_id', $waveIds)
                    ->where('shipping_gate_opened', false)
                    ->update([
                        'shipping_gate_opened' => true,
                        'gate_opened_by' => $actorId,
                        'gate_opened_at' => $now,
                        'updated_by' => $actorId,
                    ]);
            }

            $session->update([
                'status' => SessionStatus::Approved->value,
                'approved_at' => $now,
                'approved_by' => $actorId,
                'updated_by' => $actorId,
            ]);

            event(new SessionApproved($session, $actorId, $poolEntriesOpened));

            $this->timeline->record(
                companyId: $session->company_id,
                subjectType: 'PreparationSession',
                subjectId: $session->id,
                eventType: 'session.approved',
                title: "Session {$session->session_number} approved",
                description: "{$poolEntriesOpened} pool entries released to Loading OS",
                actorId: (int) $actorId,
                sourceModule: 'Operations.Preparation',
            );

            $this->audit->record(
                action: 'preparation.session.approved',
                entityType: 'PreparationSession',
                entityId: $session->id,
                companyId: $session->company_id,
                userId: (int) $actorId,
                oldValues: ['status' => SessionStatus::Completed->value],
                newValues: ['status' => SessionStatus::Approved->value, 'pool_entries_opened' => $poolEntriesOpened],
            );

            return $session->refresh();
        });
    }

    private function guardWorkflowStage(string $companyId): void
    {
        if (! $this->flags->isEnabled('workflow.stages.preparation', $companyId)) {
            throw new RuntimeException('Preparation OS workflow stage is not enabled.');
        }
    }
}
