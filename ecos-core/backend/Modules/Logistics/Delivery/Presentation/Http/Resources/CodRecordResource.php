<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Delivery\Domain\Models\CodRecord;

/**
 * @mixin CodRecord
 *
 * Reports COD completion only. Settlement figures are owned by Distribution
 * and are deliberately absent here (CTO decision 3).
 */
class CodRecordResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'attempt_id' => $this->attempt_id,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'amount_due' => (float) $this->amount_due,
            'amount_collected' => (float) $this->amount_collected,
            'shortfall' => $this->shortfall(),
            'is_fully_collected' => $this->isFullyCollected(),
            'is_outstanding' => $this->isOutstanding(),
            'blocks_closure' => $this->blocksClosure(),
            'currency' => $this->currency,
            'method' => $this->method,
            'reference_number' => $this->reference_number,
            'collected_at' => $this->collected_at?->toIso8601String(),
            'verified_at' => $this->verified_at?->toIso8601String(),
            'dispute_reason' => $this->dispute_reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
