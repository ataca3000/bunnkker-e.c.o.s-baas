<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \Modules\Purchasing\PurchaseMaterials\Domain\Models\PurchaseMaterial */
class PurchaseMaterialResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'request_number' => $this->request_number,
            'record_type' => $this->record_type ?? 'material_request',
            'source_type' => $this->source_type,
            'company_id' => $this->company_id,
            'company' => $this->whenLoaded('company', fn () => [
                'id' => $this->company->id,
                'name' => $this->company->name,
            ]),
            'channel_id' => $this->channel_id,
            'channel' => $this->whenLoaded('channel', fn () => [
                'id' => $this->channel->id,
                'name' => $this->channel->name,
                'code' => $this->channel->code,
            ]),
            'warehouse_id' => $this->warehouse_id,
            'warehouse' => $this->whenLoaded('warehouse', fn () => [
                'id' => $this->warehouse->id,
                'name' => $this->warehouse->name,
            ]),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'priority' => $this->priority->value,
            'priority_label' => $this->priority->label(),
            'requested_by' => $this->requested_by,
            'assigned_buyer' => $this->assigned_buyer,
            'required_date' => $this->required_date?->toDateString(),
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'approved_at' => $this->approved_at?->toIso8601String(),
            'estimated_value' => (float) $this->estimated_value,
            'approved_value' => (float) $this->approved_value,
            'purchased_value' => (float) $this->purchased_value,
            'approved_by' => $this->approved_by,
            'rejected_by' => $this->rejected_by,
            'rejection_reason' => $this->rejection_reason,
            'review_notes' => $this->review_notes,
            'clarification_requested_at' => $this->clarification_requested_at?->toIso8601String(),
            'notes' => $this->notes,
            'items_count' => $this->items_count ?? $this->lines?->count() ?? 0,
            'total_requested_qty' => (float) ($this->total_requested_qty ?? 0),
            'lines' => PurchaseMaterialLineResource::collection($this->whenLoaded('lines')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
