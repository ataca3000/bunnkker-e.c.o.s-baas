<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BrandCitySettingsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $city = $this->whenLoaded('city');

        return [
            'id' => $this->id,
            'brand_id' => $this->brand_id,
            'city_id' => $this->city_id,
            'is_enabled' => $this->is_enabled,
            'shipping_price' => $this->shipping_price !== null
                ? (float) $this->shipping_price
                : null,
            'supports_cod' => $this->supports_cod,
            'is_remote_override' => $this->is_remote_override,
            'city' => $city ? [
                'id' => $city->id,
                'name_ar' => $city->name_ar,
                'name_en' => $city->name_en,
                'is_active' => $city->is_active,
                'effective_shipping_price' => (float) $city->effective_shipping_price,
                'is_remote_area' => $city->is_remote_area,
                'governorate_id' => $city->governorate_id,
            ] : null,
            'updated_at' => $this->updated_at,
        ];
    }
}
