<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Operations\Loading\Domain\Enums\LoadingTaskStatus;
use Modules\Operations\Loading\Domain\Models\LoadingTask;
use Modules\Operations\Loading\Domain\Models\VehicleAssignment;
use Modules\Operations\Loading\Domain\Services\VehicleInventoryService;

final class LoadProductAction
{
    public function __construct(
        private readonly VehicleInventoryService $inventoryService,
    ) {}

    public function execute(
        VehicleAssignment $assignment,
        string $poolEntryId,
        string $productId,
        string $skuSnapshot,
        string $nameSnapshot,
        string $preparationWaveId,
        float $quantityPlanned,
        float $quantityLoaded,
        string $loadedBy,
        bool $requiresRefrigeration = false,
        ?string $shortReason = null,
        ?string $notes = null,
    ): LoadingTask {
        return DB::transaction(function () use (
            $assignment,
            $poolEntryId,
            $productId,
            $skuSnapshot,
            $nameSnapshot,
            $preparationWaveId,
            $quantityPlanned,
            $quantityLoaded,
            $loadedBy,
            $requiresRefrigeration,
            $shortReason,
            $notes,
        ): LoadingTask {
            $isShort = $quantityLoaded < $quantityPlanned;
            $quantityShort = max(0.0, $quantityPlanned - $quantityLoaded);

            $task = LoadingTask::create([
                'company_id' => $assignment->company_id,
                'loading_session_id' => $assignment->loading_session_id,
                'vehicle_assignment_id' => $assignment->id,
                'pool_entry_id' => $poolEntryId,
                'product_id' => $productId,
                'sku_snapshot' => $skuSnapshot,
                'name_snapshot' => $nameSnapshot,
                'preparation_wave_id' => $preparationWaveId,
                'quantity_planned' => $quantityPlanned,
                'quantity_loaded' => $quantityLoaded,
                'quantity_short' => $quantityShort,
                'status' => $isShort
                    ? LoadingTaskStatus::ShortLoaded->value
                    : LoadingTaskStatus::Loaded->value,
                'requires_refrigeration' => $requiresRefrigeration,
                'loaded_by' => $loadedBy,
                'loaded_at' => now(),
                'short_reason' => $shortReason,
                'notes' => $notes,
                'created_by' => $loadedBy,
                'updated_by' => $loadedBy,
            ]);

            if ($quantityLoaded > 0) {
                $this->inventoryService->recordLoad(
                    assignment: $assignment,
                    task: $task,
                    quantity: $quantityLoaded,
                    actorId: $loadedBy,
                );

                $assignment->increment('loading_weight_kg', $quantityLoaded);
            }

            return $task->fresh() ?? $task;
        });
    }
}
