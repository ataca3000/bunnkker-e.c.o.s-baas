<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Sales\Customers\Domain\Models\CustomerBrand;

/**
 * @mixin CustomerBrand
 */
final class CustomerBrandResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'brand_id'       => $this->brand_id,
            'brand_name'     => $this->brand?->name,
            'brand_code'     => $this->brand?->code,
            'is_primary'     => (bool) $this->is_primary,
            'status'         => $this->status,
            'orders_count'   => $this->orders_count,
            'lifetime_value' => $this->lifetime_value,
            'first_order_at' => $this->first_order_at?->toIso8601String(),
            'last_order_at'  => $this->last_order_at?->toIso8601String(),
            'created_at'     => $this->created_at?->toIso8601String(),
        ];
    }
}
