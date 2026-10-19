<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BrandGovernorateSettingsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $gov = $this->whenLoaded('governorate');

        return [
            'id' => $this->id,
            'brand_id' => $this->brand_id,
            'governorate_id' => $this->governorate_id,
            'is_enabled' => $this->is_enabled,
            'shipping_price' => $this->shipping_price !== null
                ? (float) $this->shipping_price
                : null,
            'estimated_delivery_days' => $this->estimated_delivery_days,
            'same_day_supported' => $this->same_day_supported,
            'display_order' => $this->display_order,
            'preferred_provider' => $this->preferred_provider,
            'governorate' => $gov ? [
                'id' => $gov->id,
                'name_ar' => $gov->name_ar,
                'name_en' => $gov->name_en,
                'default_shipping_price' => (float) $gov->default_shipping_price,
                'is_active' => $gov->is_active,
                'cities_count' => $gov->cities()->count(),
            ] : null,
            'updated_at' => $this->updated_at,
        ];
    }
}
