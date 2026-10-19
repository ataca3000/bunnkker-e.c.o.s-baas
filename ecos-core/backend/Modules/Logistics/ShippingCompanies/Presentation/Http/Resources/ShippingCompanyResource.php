<?php

declare(strict_types=1);

namespace Modules\Logistics\ShippingCompanies\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingCompany;

/**
 * @mixin ShippingCompany
 */
class ShippingCompanyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'type' => $this->type,
            'contact_person' => $this->contact_person,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'notes' => $this->notes,
            'status' => $this->status,
            'contracts_count' => $this->whenCounted('contracts'),
            'companies_count' => $this->whenCounted('mappings'),
            'active_contract' => new ShippingContractResource($this->whenLoaded('activeContract')),
            'contracts' => ShippingContractResource::collection($this->whenLoaded('contracts')),
            'mappings' => ShippingCompanyMappingResource::collection($this->whenLoaded('mappings')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
