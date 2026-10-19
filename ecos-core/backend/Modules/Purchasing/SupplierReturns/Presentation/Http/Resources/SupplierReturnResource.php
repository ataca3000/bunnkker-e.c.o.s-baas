<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierReturns\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class SupplierReturnResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'return_number' => $this->return_number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_color' => $this->status->color(),
            'reason' => $this->reason,
            'quality_condition' => $this->quality_condition,
            'return_date' => $this->return_date?->toDateString(),
            'expected_credit_date' => $this->expected_credit_date?->toDateString(),
            'notes' => $this->notes,
            'total_return_value' => (float) $this->total_return_value,
            'credit_method' => $this->credit_method,
            'credit_amount' => $this->credit_amount !== null ? (float) $this->credit_amount : null,
            'debit_note_number' => $this->debit_note_number,
            'credit_received_date' => $this->credit_received_date?->toDateString(),
            'inventory_restocked' => $this->inventory_restocked,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'approved_at' => $this->approved_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            // Relations
            'supplier' => $this->whenLoaded('supplier', fn () => [
                'id' => $this->supplier->id,
                'name' => $this->supplier->name,
            ]),
            'warehouse' => $this->whenLoaded('warehouse', fn () => [
                'id' => $this->warehouse->id,
                'name' => $this->warehouse->name,
                'code' => $this->warehouse->code,
            ]),
            'lines' => $this->whenLoaded('lines', fn () => $this->lines->map(fn ($line) => [
                'id' => $line->id,
                'product_id' => $line->product_id,
                'product' => $line->product ? [
                    'id' => $line->product->id,
                    'name' => $line->product->name,
                    'sku' => $line->product->sku,
                ] : null,
                'return_quantity' => (float) $line->return_quantity,
                'unit_cost' => (float) $line->unit_cost,
                'total_cost' => (float) $line->total_cost,
                'reason' => $line->reason,
                'quality_condition' => $line->quality_condition,
                'notes' => $line->notes,
                'uom_name_snapshot' => $line->uom_name_snapshot,
                'uom_symbol_snapshot' => $line->uom_symbol_snapshot,
            ])->toArray(),
            ),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
