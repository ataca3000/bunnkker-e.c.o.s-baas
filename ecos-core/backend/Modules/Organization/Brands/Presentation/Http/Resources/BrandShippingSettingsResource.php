<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BrandShippingSettingsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'brand_id' => $this->brand_id,
            'unsupported_governorate_action' => $this->unsupported_governorate_action,
            'unsupported_city_action' => $this->unsupported_city_action,
            'default_cod_enabled' => $this->default_cod_enabled,
            'default_free_shipping_threshold' => $this->default_free_shipping_threshold
                ? (float) $this->default_free_shipping_threshold
                : null,
            'default_shipping_provider' => $this->default_shipping_provider,
            'updated_at' => $this->updated_at,
        ];
    }
}
