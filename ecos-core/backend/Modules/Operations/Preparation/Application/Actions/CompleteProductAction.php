<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use App\Core\Audit\AuditService;
use App\Core\FeatureFlags\FeatureFlagService;
use App\Core\Timeline\TimelineService;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Domain\Enums\WaveItemStatus;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Events\ProductPrepared;
use Modules\Operations\Preparation\Domain\Exceptions\InvalidWaveStatusTransitionException;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveItem;
use Modules\Operations\Preparation\Domain\Services\FulfillmentPolicyService;

final class CompleteProductAction
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly TimelineService $timeline,
        private readonly FulfillmentPolicyService $fulfillmentPolicy,
        private readonly FeatureFlagService $flags,
    ) {}

    public function execute(
        PreparationWave $wave,
        PreparationWaveItem $item,
        float $quantityPrepared,
        string $actorId,
        ?string $notes = null,
    ): PreparationWaveItem {
        $this->guardWorkflowStage($wave->company_id);

        if ($wave->status !== WaveStatus::Preparing) {
            throw InvalidWaveStatusTransitionException::from($wave->status, WaveStatus::Preparing);
        }

        $tolerance = $this->fulfillmentPolicy->overprepareTolerance($wave->company_id);
        $maxAllowed = $item->quantity_required * (1 + $tolerance);

        if ($quantityPrepared > $maxAllowed) {
            abort(422, sprintf(
                'Quantity prepared (%.2f) exceeds overprepare tolerance of %.0f%% (max %.2f).',
                $quantityPrepared,
                $tolerance * 100,
                $maxAllowed,
            ), ['code' => 'overprepare_exceeded']);
        }

        return DB::transaction(function () use ($wave, $item, $quantityPrepared, $actorId, $notes): PreparationWaveItem {
            $quantityShort = max(0.0, $item->quantity_required - $quantityPrepared);
            $status = $quantityShort > 0
                ? WaveItemStatus::Short
                : WaveItemStatus::Prepared;

            $now = now();

            $item->update([
                'quantity_prepared' => $quantityPrepared,
                'quantity_short' => $quantityShort,
                'status' => $status->value,
                'prepared_at' => $now,
                'prepared_by' => $actorId,
                'notes' => $notes,
                'updated_by' => $actorId,
            ]);

            $wave->increment('total_units_prepared', $quantityPrepared);
            $wave->update(['updated_by' => $actorId]);

            event(new ProductPrepared(
                waveId: $wave->id,
                companyId: $wave->company_id,
                waveItemId: $item->id,
                productId: $item->product_id,
                sku: $item->sku_snapshot,
                quantityRequired: $item->quantity_required,
                quantityPrepared: $quantityPrepared,
                quantityShort: $quantityShort,
                status: $status->value,
                preparedBy: $actorId,
                preparedAt: $now->toIso8601String(),
            ));

            $this->timeline->record(
                companyId: $wave->company_id,
                subjectType: 'PreparationWave',
                subjectId: $wave->id,
                eventType: 'wave.product_prepared',
                title: "Product {$item->sku_snapshot} prepared",
                description: "{$quantityPrepared}/{$item->quantity_required} units".($quantityShort > 0 ? " ({$quantityShort} short)" : ''),
                actorId: (int) $actorId,
                sourceModule: 'Operations.Preparation',
            );

            $this->audit->record(
                action: 'preparation.wave_item.completed',
                entityType: 'PreparationWaveItem',
                entityId: $item->id,
                companyId: $wave->company_id,
                userId: (int) $actorId,
                newValues: ['quantity_prepared' => $quantityPrepared, 'quantity_short' => $quantityShort, 'status' => $status->value],
            );

            return $item->fresh() ?? $item;
        });
    }

    private function guardWorkflowStage(string $companyId): void
    {
        if ($this->flags->isDisabled('workflow.stages.preparation', $companyId)) {
            abort(503, 'Preparation stage is not enabled in the active fulfillment profile.');
        }
    }
}
