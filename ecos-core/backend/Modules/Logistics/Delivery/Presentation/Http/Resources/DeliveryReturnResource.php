<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Delivery\Domain\Models\DeliveryReturn;
use Modules\Logistics\Delivery\Domain\Models\DeliveryReturnLine;

/**
 * @mixin DeliveryReturn
 */
class DeliveryReturnResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'delivery_id' => $this->delivery_id,
            'attempt_id' => $this->attempt_id,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'is_terminal' => $this->status->isTerminal(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),
            'reason_code' => $this->reason_code,
            'reason' => $this->reason,
            'has_discrepancy' => $this->has_discrepancy,
            'total_returned_qty' => $this->when(
                $this->relationLoaded('lines'),
                fn () => $this->totalReturnedQty()
            ),
            'initiated_at' => $this->initiated_at?->toIso8601String(),
            'initiated_by' => $this->initiated_by,
            'received_at' => $this->received_at?->toIso8601String(),
            'received_by' => $this->received_by,
            'verified_at' => $this->verified_at?->toIso8601String(),
            'verified_by' => $this->verified_by,
            'notes' => $this->notes,
            'lines' => $this->whenLoaded('lines', fn () => $this->lines->map(
                static fn (DeliveryReturnLine $line) => [
                    'id' => $line->id,
                    'product_id' => $line->product_id,
                    'product_name' => $line->product_name,
                    'ordered_qty' => (float) $line->ordered_qty,
                    'delivered_qty' => (float) $line->delivered_qty,
                    'returned_qty' => (float) $line->returned_qty,
                    'undelivered_qty' => $line->undeliveredQty(),
                    'warehouse_confirmed_qty' => $line->warehouse_confirmed_qty !== null
                        ? (float) $line->warehouse_confirmed_qty
                        : null,
                    'discrepancy_qty' => $line->discrepancy_qty !== null
                        ? (float) $line->discrepancy_qty
                        : null,
                    'has_discrepancy' => $line->hasDiscrepancy(),
                    'notes' => $line->notes,
                ]
            )->all()),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
