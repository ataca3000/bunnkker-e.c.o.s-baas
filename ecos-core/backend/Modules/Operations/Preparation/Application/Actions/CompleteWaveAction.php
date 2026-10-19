<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\Audit\AuditService;
use App\Core\FeatureFlags\FeatureFlagService;
use App\Core\Timeline\TimelineService;
use App\Models\User;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Operations\Preparation\Application\Notifications\WaveCompletedNotification;
use Modules\Operations\Preparation\Application\Services\SoftReservationService;
use Modules\Operations\Preparation\Domain\Enums\PoolMovementType;
use Modules\Operations\Preparation\Domain\Enums\QualityStatus;
use Modules\Operations\Preparation\Domain\Enums\WaveItemStatus;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Events\PoolUpdated;
use Modules\Operations\Preparation\Domain\Events\WaveCompleted;
use Modules\Operations\Preparation\Domain\Exceptions\InvalidWaveStatusTransitionException;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparedPoolMovement;
use Modules\Operations\Preparation\Domain\Models\PreparedProductsPool;

final class CompleteWaveAction
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly TimelineService $timeline,
        private readonly FeatureFlagService $flags,
        private readonly SoftReservationService $softReservation,
    ) {}

    public function execute(PreparationWave $wave, string $actorId): PreparationWave
    {
        $this->guardWorkflowStage($wave->company_id);

        if ($wave->status !== WaveStatus::Preparing) {
            throw InvalidWaveStatusTransitionException::from($wave->status, WaveStatus::Completed);
        }

        $incompleteItems = $wave->waveItems()
            ->whereIn('status', [WaveItemStatus::InProgress->value, WaveItemStatus::Blocked->value])
            ->count();

        if ($incompleteItems > 0) {
            throw new DomainException(
                "Cannot complete wave [{$wave->id}]: {$incompleteItems} item(s) still in progress or blocked.",
            );
        }

        return DB::transaction(function () use ($wave, $actorId): PreparationWave {
            $now = now();
            $poolEntries = 0;
            $shortItems = [];
            // Determine whether this wave belongs to a session.
            // Pool entries for session-owned waves have gate closed until session approval.
            $hasSession = ! is_null($wave->preparation_session_id);
            $gateOpenNow = ! $hasSession; // standalone waves open gate immediately

            foreach ($wave->waveItems as $item) {
                if ($item->quantity_prepared <= 0) {
                    continue;
                }

                $pool = PreparedProductsPool::where([
                    'preparation_wave_id' => $wave->id,
                    'product_id' => $item->product_id,
                    'warehouse_id' => $wave->warehouse_id,
                ])->first();

                if ($pool) {
                    $pool->increment('quantity_available', $item->quantity_prepared);
                    $pool->update(['updated_by' => $actorId]);
                } else {
                    $pool = PreparedProductsPool::create([
                        'company_id' => $wave->company_id,
                        'warehouse_id' => $wave->warehouse_id,
                        'product_id' => $item->product_id,
                        'sku_snapshot' => $item->sku_snapshot,
                        'name_snapshot' => $item->name_snapshot,
                        'preparation_wave_id' => $wave->id,
                        'quantity_available' => $item->quantity_prepared,
                        'quantity_reserved' => 0,
                        'quantity_loaded' => 0,
                        'quality_status' => QualityStatus::PendingReview->value,
                        'shipping_gate_opened' => $gateOpenNow,
                        'prepared_at' => $now,
                        'created_by' => $actorId,
                        'updated_by' => $actorId,
                    ]);
                    $poolEntries++;
                }

                PreparedPoolMovement::create([
                    'id' => Str::ulid()->toString(),
                    'company_id' => $wave->company_id,
                    'pool_entry_id' => $pool->id,
                    'movement_type' => PoolMovementType::Created->value,
                    'quantity_moved' => $item->quantity_prepared,
                    'actor_id' => $actorId,
                    'actor_type' => 'user',
                    'recorded_at' => $now,
                ]);

                event(new PoolUpdated(
                    poolEntryId: $pool->id,
                    productId: $item->product_id,
                    sku: $item->sku_snapshot,
                    warehouseId: $wave->warehouse_id,
                    preparationWaveId: $wave->id,
                    companyId: $wave->company_id,
                    movementType: PoolMovementType::Created->value,
                    quantityMoved: $item->quantity_prepared,
                    quantityAvailable: $pool->quantity_available,
                    quantityReserved: 0,
                    qualityStatus: QualityStatus::PendingReview->value,
                    recordedAt: $now->toIso8601String(),
                ));

                if ($item->quantity_short > 0) {
                    $shortItems[] = [
                        'product_id' => $item->product_id,
                        'sku' => $item->sku_snapshot,
                        'quantity_short' => $item->quantity_short,
                    ];
                }
            }

            $totalPrepared = (float) $wave->waveItems()->sum('quantity_prepared');
            $completionPct = $wave->total_units_required > 0
                ? round(($totalPrepared / $wave->total_units_required) * 100, 1)
                : 0.0;
            $durationMinutes = $wave->started_at
                ? (int) round($now->diffInMinutes($wave->started_at))
                : 0;

            $wave->update([
                'status' => WaveStatus::Completed->value,
                'completed_at' => $now,
                'completed_by' => $actorId,
                'total_units_prepared' => $totalPrepared,
                'updated_by' => $actorId,
            ]);

            event(new WaveCompleted(
                waveId: $wave->id,
                waveNumber: $wave->wave_number,
                companyId: $wave->company_id,
                warehouseId: $wave->warehouse_id,
                planningDate: $wave->planning_date->toDateString(),
                completedBy: $actorId,
                completedAt: $now->toIso8601String(),
                startedAt: $wave->started_at?->toIso8601String() ?? $now->toIso8601String(),
                durationMinutes: $durationMinutes,
                ordersCount: $wave->orders_count,
                productsCount: $wave->products_count,
                totalUnitsRequired: $wave->total_units_required,
                totalUnitsPrepared: $totalPrepared,
                completionPct: $completionPct,
                shortItems: $shortItems,
                poolEntriesCreated: $poolEntries,
            ));

            $creator = User::find($wave->created_by);
            if ($creator) {
                $creator->notify(new WaveCompletedNotification(
                    $wave->wave_number,
                    $wave->id,
                    $completionPct,
                    $poolEntries,
                ));
            }

            $this->timeline->record(
                companyId: $wave->company_id,
                subjectType: 'PreparationWave',
                subjectId: $wave->id,
                eventType: 'wave.completed',
                title: "Wave {$wave->wave_number} completed — {$completionPct}% fulfillment",
                description: "{$poolEntries} pool entries created, {$durationMinutes} minutes duration",
                actorId: (int) $actorId,
                sourceModule: 'Operations.Preparation',
            );

            $this->audit->record(
                action: 'preparation.wave.completed',
                entityType: 'PreparationWave',
                entityId: $wave->id,
                companyId: $wave->company_id,
                userId: (int) $actorId,
                oldValues: ['status' => WaveStatus::Preparing->value],
                newValues: [
                    'status' => WaveStatus::Completed->value,
                    'completion_pct' => $completionPct,
                    'pool_entries' => $poolEntries,
                    'duration_minutes' => $durationMinutes,
                ],
            );

            // Mark soft reservations as consumed — stock has been physically used.
            $this->softReservation->consume($wave, $actorId);

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
