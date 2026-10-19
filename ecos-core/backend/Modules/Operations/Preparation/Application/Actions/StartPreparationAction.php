<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\Audit\AuditService;
use App\Core\FeatureFlags\FeatureFlagService;
use App\Core\Timeline\TimelineService;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Application\DTOs\StartPreparationDTO;
use Modules\Operations\Preparation\Application\Notifications\WaveStartedNotification;
use Modules\Operations\Preparation\Application\Services\SoftReservationService;
use Modules\Operations\Preparation\Domain\Enums\PickListItemStatus;
use Modules\Operations\Preparation\Domain\Enums\PickListStatus;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Events\WaveStarted;
use Modules\Operations\Preparation\Domain\Events\WorkerAssigned;
use Modules\Operations\Preparation\Domain\Exceptions\InvalidWaveStatusTransitionException;
use Modules\Operations\Preparation\Domain\Exceptions\ShortageNotResolvedException;
use Modules\Operations\Preparation\Domain\Models\PreparationPickList;
use Modules\Operations\Preparation\Domain\Models\PreparationPickListItem;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveWorker;
use Modules\Operations\Preparation\Domain\Services\FulfillmentPolicyService;

final class StartPreparationAction
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly TimelineService $timeline,
        private readonly FulfillmentPolicyService $fulfillmentPolicy,
        private readonly FeatureFlagService $flags,
        private readonly SoftReservationService $softReservation,
    ) {}

    public function execute(PreparationWave $wave, StartPreparationDTO $dto): PreparationWave
    {
        $this->guardWorkflowStage($wave->company_id);

        $allowedStatuses = [WaveStatus::Planning, WaveStatus::ShortageBlocked];

        if (! in_array($wave->status, $allowedStatuses, true)) {
            throw InvalidWaveStatusTransitionException::from($wave->status, WaveStatus::Preparing);
        }

        if ($wave->shortage_detected && ! $dto->overrideShortage) {
            throw new ShortageNotResolvedException($wave->id);
        }

        if ($this->fulfillmentPolicy->requiresWaveApproval($wave->company_id) && ! $wave->approved_by) {
            abort(422, 'Wave requires approval before it can be started.', ['code' => 'wave_approval_required']);
        }

        return DB::transaction(function () use ($wave, $dto): PreparationWave {
            $now = now();

            $wave->update([
                'status' => WaveStatus::Preparing->value,
                'started_at' => $now,
                'started_by' => $dto->actorId,
                'updated_by' => $dto->actorId,
            ]);

            $pickList = PreparationPickList::create([
                'company_id' => $wave->company_id,
                'preparation_wave_id' => $wave->id,
                'status' => PickListStatus::Pending->value,
                'generated_at' => $now,
                'generated_by' => $dto->actorId,
                'created_by' => $dto->actorId,
                'updated_by' => $dto->actorId,
            ]);

            foreach ($wave->waveItems as $item) {
                PreparationPickListItem::create([
                    'company_id' => $wave->company_id,
                    'pick_list_id' => $pickList->id,
                    'product_id' => $item->product_id,
                    'sku_snapshot' => $item->sku_snapshot,
                    'name_snapshot' => $item->name_snapshot,
                    'quantity_to_pick' => $item->quantity_required,
                    'quantity_picked' => 0,
                    'status' => PickListItemStatus::Pending->value,
                    'created_by' => $dto->actorId,
                    'updated_by' => $dto->actorId,
                ]);
            }

            $workersAssigned = [];
            foreach ($dto->workers as $worker) {
                $waveWorker = PreparationWaveWorker::create([
                    'company_id' => $wave->company_id,
                    'preparation_wave_id' => $wave->id,
                    'user_id' => $worker['user_id'],
                    'role' => $worker['role'],
                    'assigned_by' => $dto->actorId,
                ]);

                $workersAssigned[] = ['user_id' => $worker['user_id'], 'role' => $worker['role']];

                event(new WorkerAssigned(
                    waveId: $wave->id,
                    waveNumber: $wave->wave_number,
                    companyId: $wave->company_id,
                    userId: $worker['user_id'],
                    userName: $worker['name'] ?? 'Unknown',
                    role: $worker['role'],
                    assignedBy: $dto->actorId,
                    assignedAt: $waveWorker->assigned_at->toIso8601String(),
                ));

                $workerUser = User::find($worker['user_id']);
                if ($workerUser) {
                    $workerUser->notify(new WaveStartedNotification(
                        $wave->wave_number,
                        $wave->id,
                        $worker['role'],
                    ));
                }
            }

            $orderIds = $wave->waveOrders()->pluck('order_id')->toArray();

            event(new WaveStarted(
                waveId: $wave->id,
                waveNumber: $wave->wave_number,
                companyId: $wave->company_id,
                warehouseId: $wave->warehouse_id,
                planningDate: $wave->planning_date->toDateString(),
                orderIds: $orderIds,
                startedBy: $dto->actorId,
                startedAt: $now->toIso8601String(),
                workersAssigned: $workersAssigned,
            ));

            $this->timeline->record(
                companyId: $wave->company_id,
                subjectType: 'PreparationWave',
                subjectId: $wave->id,
                eventType: 'wave.started',
                title: "Wave {$wave->wave_number} started",
                description: count($workersAssigned).' worker(s) assigned',
                actorId: (int) $dto->actorId,
                sourceModule: 'Operations.Preparation',
            );

            $this->audit->record(
                action: 'preparation.wave.started',
                entityType: 'PreparationWave',
                entityId: $wave->id,
                companyId: $wave->company_id,
                userId: (int) $dto->actorId,
                oldValues: ['status' => WaveStatus::Planning->value],
                newValues: ['status' => WaveStatus::Preparing->value, 'workers_assigned' => count($workersAssigned)],
            );

            // Soft-reserve inventory for this wave now that preparation has started.
            $wave->loadMissing(['materialRequirements', 'productionRequirements']);
            $this->softReservation->reserve($wave, $dto->actorId);

            return $wave->fresh(['pickList', 'workers']) ?? $wave;
        });
    }

    private function guardWorkflowStage(string $companyId): void
    {
        if ($this->flags->isDisabled('workflow.stages.preparation', $companyId)) {
            abort(503, 'Preparation stage is not enabled in the active fulfillment profile.');
        }
    }
}
