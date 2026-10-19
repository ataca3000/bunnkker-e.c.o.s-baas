<?php

declare(strict_types=1);

namespace Modules\Logistics\Geography\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class CityResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'governorate_id' => $this->governorate_id,
            'name_ar' => $this->name_ar,
            'name_en' => $this->name_en,
            'shipping_price' => $this->shipping_price !== null ? (float) $this->shipping_price : null,
            'effective_shipping_price' => (float) $this->effectiveShippingPrice(),
            'uses_governorate_price' => $this->shipping_price === null,
            'display_order' => $this->display_order,
            'is_active' => $this->is_active,
            'is_system' => $this->is_system,
            'aliases_count' => $this->whenCounted('aliases'),
            'aliases' => CityAliasResource::collection($this->whenLoaded('aliases')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
