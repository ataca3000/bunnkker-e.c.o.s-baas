<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\Audit\AuditService;
use App\Core\FeatureFlags\FeatureFlagService;
use App\Core\Timeline\TimelineService;
use DomainException;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Application\Services\SoftReservationService;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Events\WaveCancelled;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;

final class CancelWaveAction
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly TimelineService $timeline,
        private readonly FeatureFlagService $flags,
        private readonly SoftReservationService $softReservation,
    ) {}

    public function execute(PreparationWave $wave, string $actorId, string $reason): PreparationWave
    {
        $this->guardWorkflowStage($wave->company_id);

        if ($wave->status === WaveStatus::Completed) {
            throw new DomainException('Cannot cancel a completed preparation wave.');
        }

        if ($wave->status === WaveStatus::Cancelled) {
            throw new DomainException('Preparation wave is already cancelled.');
        }

        return DB::transaction(function () use ($wave, $actorId, $reason): PreparationWave {
            $statusBefore = $wave->status->value;
            $now = now();
            $orderIds = $wave->waveOrders()->pluck('order_id')->toArray();

            $wave->update([
                'status' => WaveStatus::Cancelled->value,
                'cancelled_at' => $now,
                'cancelled_by' => $actorId,
                'cancellation_reason' => $reason,
                'updated_by' => $actorId,
            ]);

            $wave->workers()
                ->whereNull('released_at')
                ->update([
                    'released_at' => $now,
                    'released_by' => $actorId,
                ]);

            // Release any soft reservations so the stock becomes available to other waves.
            $this->softReservation->release($wave, $actorId);

            event(new WaveCancelled(
                waveId: $wave->id,
                waveNumber: $wave->wave_number,
                companyId: $wave->company_id,
                warehouseId: $wave->warehouse_id,
                statusBeforeCancel: $statusBefore,
                cancelledBy: $actorId,
                cancelledAt: $now->toIso8601String(),
                reason: $reason,
                ordersCount: $wave->orders_count,
                orderIds: $orderIds,
            ));

            $this->timeline->record(
                companyId: $wave->company_id,
                subjectType: 'PreparationWave',
                subjectId: $wave->id,
                eventType: 'wave.cancelled',
                title: "Wave {$wave->wave_number} cancelled",
                description: $reason,
                actorId: (int) $actorId,
                sourceModule: 'Operations.Preparation',
            );

            $this->audit->record(
                action: 'preparation.wave.cancelled',
                entityType: 'PreparationWave',
                entityId: $wave->id,
                companyId: $wave->company_id,
                userId: (int) $actorId,
                oldValues: ['status' => $statusBefore],
                newValues: ['status' => WaveStatus::Cancelled->value, 'cancellation_reason' => $reason],
            );

            return $wave->fresh() ?? $wave;
        });
    }

    private function guardWorkflowStage(string $companyId): void
    {
        if ($this->flags->isDisabled('workflow.stages.preparation', $companyId)) {
            abort(503, 'Preparation stage is not enabled in the active fulfillment profile.');
        }
    }
}
