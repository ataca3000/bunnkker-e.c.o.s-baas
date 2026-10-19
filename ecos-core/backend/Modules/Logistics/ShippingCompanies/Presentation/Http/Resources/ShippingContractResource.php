<?php

declare(strict_types=1);

namespace Modules\Logistics\ShippingCompanies\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingContract;

/**
 * @mixin ShippingContract
 */
class ShippingContractResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'shipping_company_id' => $this->shipping_company_id,
            'name' => $this->name,
            'start_date' => $this->start_date?->format('Y-m-d'),
            'end_date' => $this->end_date?->format('Y-m-d'),
            'payment_terms' => $this->payment_terms,
            'notes' => $this->notes,
            'status' => $this->status,
            'is_expired' => $this->isExpired(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
