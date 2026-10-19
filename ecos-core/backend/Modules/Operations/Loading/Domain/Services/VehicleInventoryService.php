<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Operations\Loading\Domain\Enums\MovementType;
use Modules\Operations\Loading\Domain\Enums\VehicleInventoryItemStatus;
use Modules\Operations\Loading\Domain\Models\LoadingTask;
use Modules\Operations\Loading\Domain\Models\VehicleAssignment;
use Modules\Operations\Loading\Domain\Models\VehicleInventoryItem;
use Modules\Operations\Loading\Domain\Models\VehicleInventoryMovement;

final class VehicleInventoryService
{
    /**
     * Record product load — create/update VehicleInventoryItem + append movement.
     */
    public function recordLoad(
        VehicleAssignment $assignment,
        LoadingTask $task,
        float $quantity,
        string $actorId,
    ): VehicleInventoryItem {
        return DB::transaction(function () use ($assignment, $task, $quantity, $actorId): VehicleInventoryItem {
            $item = VehicleInventoryItem::firstOrNew([
                'vehicle_assignment_id' => $assignment->id,
                'product_id' => $task->product_id,
            ]);

            if (! $item->exists) {
                $item->fill([
                    'id' => (string) Str::uuid(),
                    'company_id' => $assignment->company_id,
                    'vehicle_id' => $assignment->vehicle_id,
                    'sku_snapshot' => $task->sku_snapshot,
                    'name_snapshot' => $task->name_snapshot,
                    'operational_date' => $task->loaded_at?->toDateString() ?? now()->toDateString(),
                    'pool_entry_id' => $task->pool_entry_id,
                    'loading_task_id' => $task->id,
                    'requires_refrigeration' => $task->requires_refrigeration,
                    'created_by' => $actorId,
                ]);
            }

            $item->quantity_loaded = ($item->quantity_loaded ?? 0.0) + $quantity;
            $item->quantity_on_hand = ($item->quantity_on_hand ?? 0.0) + $quantity;
            $item->quantity_unallocated = ($item->quantity_unallocated ?? 0.0) + $quantity;
            $item->status = VehicleInventoryItemStatus::Active->value;
            $item->last_movement_at = now();
            $item->updated_by = $actorId;
            $item->save();

            $this->appendMovement(
                item: $item,
                movementType: MovementType::Loaded->value,
                quantity: $quantity,
                referenceType: 'loading_task',
                referenceId: $task->id,
                actorId: $actorId,
                actorType: 'user',
            );

            return $item->fresh() ?? $item;
        });
    }

    /**
     * Reserve quantity for an allocation (earmark — does not physically move product).
     */
    public function allocate(
        VehicleInventoryItem $item,
        string $allocationRecordId,
        float $quantity,
        string $actorId,
    ): VehicleInventoryItem {
        return DB::transaction(function () use ($item, $allocationRecordId, $quantity, $actorId): VehicleInventoryItem {
            $item->quantity_allocated = ($item->quantity_allocated ?? 0.0) + $quantity;
            $item->quantity_unallocated = max(0.0, ($item->quantity_unallocated ?? 0.0) - $quantity);
            $item->last_movement_at = now();
            $item->updated_by = $actorId;
            $item->save();

            $this->appendMovement(
                item: $item,
                movementType: MovementType::Allocated->value,
                quantity: $quantity,
                referenceType: 'order_allocation',
                referenceId: $allocationRecordId,
                actorId: $actorId,
                actorType: 'system',
            );

            return $item->fresh() ?? $item;
        });
    }

    /**
     * Release previously allocated quantity back to unallocated pool.
     */
    public function unallocate(
        VehicleInventoryItem $item,
        string $allocationRecordId,
        float $quantity,
        string $actorId,
    ): VehicleInventoryItem {
        return DB::transaction(function () use ($item, $allocationRecordId, $quantity, $actorId): VehicleInventoryItem {
            $item->quantity_allocated = max(0.0, ($item->quantity_allocated ?? 0.0) - $quantity);
            $item->quantity_unallocated = ($item->quantity_unallocated ?? 0.0) + $quantity;
            $item->last_movement_at = now();
            $item->updated_by = $actorId;
            $item->save();

            $this->appendMovement(
                item: $item,
                movementType: MovementType::Unallocated->value,
                quantity: $quantity,
                referenceType: 'order_allocation',
                referenceId: $allocationRecordId,
                actorId: $actorId,
                actorType: 'user',
            );

            return $item->fresh() ?? $item;
        });
    }

    /**
     * Record delivery of product to customer.
     */
    public function recordDelivery(
        VehicleInventoryItem $item,
        string $orderId,
        float $quantity,
        string $actorId,
        string $actorType = 'driver',
    ): VehicleInventoryItem {
        return DB::transaction(function () use ($item, $orderId, $quantity, $actorId, $actorType): VehicleInventoryItem {
            $item->quantity_delivered = ($item->quantity_delivered ?? 0.0) + $quantity;
            $item->quantity_on_hand = max(
                0.0,
                ($item->quantity_loaded ?? 0.0) - ($item->quantity_delivered ?? 0.0) - ($item->quantity_returned ?? 0.0),
            );
            $item->last_movement_at = now();
            $item->updated_by = $actorId;

            if ($item->quantity_on_hand <= 0) {
                $item->status = VehicleInventoryItemStatus::Depleted->value;
            }

            $item->save();

            $this->appendMovement(
                item: $item,
                movementType: MovementType::Delivered->value,
                quantity: $quantity,
                referenceType: 'order_allocation',
                referenceId: $orderId,
                actorId: $actorId,
                actorType: $actorType,
            );

            return $item->fresh() ?? $item;
        });
    }

    /**
     * Record product return to warehouse at end of shift.
     */
    public function recordReturn(
        VehicleInventoryItem $item,
        float $quantity,
        string $reconciliationLineId,
        string $actorId,
    ): VehicleInventoryItem {
        return DB::transaction(function () use ($item, $quantity, $reconciliationLineId, $actorId): VehicleInventoryItem {
            $item->quantity_returned = ($item->quantity_returned ?? 0.0) + $quantity;
            $item->quantity_on_hand = max(
                0.0,
                ($item->quantity_loaded ?? 0.0) - ($item->quantity_delivered ?? 0.0) - ($item->quantity_returned ?? 0.0),
            );
            $item->status = VehicleInventoryItemStatus::Returned->value;
            $item->last_movement_at = now();
            $item->updated_by = $actorId;
            $item->save();

            $this->appendMovement(
                item: $item,
                movementType: MovementType::Returned->value,
                quantity: $quantity,
                referenceType: 'reconciliation',
                referenceId: $reconciliationLineId,
                actorId: $actorId,
                actorType: 'user',
            );

            return $item->fresh() ?? $item;
        });
    }

    private function appendMovement(
        VehicleInventoryItem $item,
        string $movementType,
        float $quantity,
        string $referenceType,
        string $referenceId,
        string $actorId,
        string $actorType,
        ?string $notes = null,
    ): void {
        VehicleInventoryMovement::create([
            'id' => Str::ulid()->toBase32(),
            'company_id' => $item->company_id,
            'vehicle_inventory_item_id' => $item->id,
            'vehicle_assignment_id' => $item->vehicle_assignment_id,
            'vehicle_id' => $item->vehicle_id,
            'product_id' => $item->product_id,
            'operational_date' => $item->operational_date,
            'movement_type' => $movementType,
            'quantity' => $quantity,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'actor_id' => $actorId,
            'actor_type' => $actorType,
            'notes' => $notes,
            'recorded_at' => now(),
        ]);
    }
}
