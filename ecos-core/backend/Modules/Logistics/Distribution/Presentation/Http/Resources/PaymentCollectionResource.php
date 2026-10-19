<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Distribution\Domain\Models\PaymentCollection;

/**
 * @mixin PaymentCollection
 */
class PaymentCollectionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'trip_id' => $this->trip_id,
            'stop_id' => $this->stop_id,
            'payment_type' => $this->payment_type->value,
            'payment_type_label' => $this->payment_type->label(),
            'is_physical_cash' => $this->payment_type->isPhysicalCash(),
            'amount' => (float) $this->amount,
            'reference_number' => $this->reference_number,
            'status' => $this->status,
            'counts_toward_cash_expected' => $this->countsTowardCashExpected(),
            'verified_at' => $this->verified_at?->toIso8601String(),
            'verified_by' => $this->verified_by,
            'collected_by' => $this->collected_by,
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
