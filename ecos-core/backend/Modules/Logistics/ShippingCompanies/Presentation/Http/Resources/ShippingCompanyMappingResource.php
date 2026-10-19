<?php

declare(strict_types=1);

namespace Modules\Logistics\ShippingCompanies\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingCompanyMapping;

/**
 * @mixin ShippingCompanyMapping
 */
class ShippingCompanyMappingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'shipping_company_id' => $this->shipping_company_id,
            'company_id' => $this->company_id,
            'company_name' => $this->whenLoaded('company', fn () => $this->company?->name),
            'company_code' => $this->whenLoaded('company', fn () => $this->company?->code),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
