<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Sales\Customers\Domain\Models\Customer;

/**
 * @mixin Customer
 */
final class CustomerResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'company_id'     => $this->company_id,
            'code'           => $this->code,
            'name'           => $this->name,
            'contact_person' => $this->contact_person,
            'email'          => $this->email,
            'phone'          => $this->phone,
            'mobile'         => $this->mobile,
            'country'        => $this->country,
            'city'           => $this->city,
            'address'        => $this->address,
            'notes'          => $this->notes,
            'is_active'      => (bool) $this->is_active,
            'brands'         => CustomerBrandResource::collection($this->whenLoaded('customerBrands')),
            'created_at'     => $this->created_at?->toIso8601String(),
            'updated_at'     => $this->updated_at?->toIso8601String(),
        ];
    }
}
