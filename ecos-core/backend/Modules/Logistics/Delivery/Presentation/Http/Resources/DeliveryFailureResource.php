<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Delivery\Domain\Models\DeliveryFailure;

/**
 * @mixin DeliveryFailure
 */
class DeliveryFailureResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'attempt_id' => $this->attempt_id,
            'reason_code' => $this->reason_code->value,
            'reason_label' => $this->reason_code->label(),
            'category' => $this->category->value,
            'category_label' => $this->category->label(),
            'is_retryable' => $this->is_retryable,
            'requires_address_correction' => $this->requires_address_correction,
            'is_customer_fault' => $this->isCustomerFault(),
            'description' => $this->description,
            'photos' => $this->photos ?? [],
            'reported_by' => $this->reported_by,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
