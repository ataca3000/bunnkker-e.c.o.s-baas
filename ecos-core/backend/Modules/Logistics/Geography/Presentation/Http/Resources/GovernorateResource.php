<?php

declare(strict_types=1);

namespace Modules\Logistics\Geography\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class GovernorateResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'country_id' => $this->country_id,
            'name_ar' => $this->name_ar,
            'name_en' => $this->name_en,
            'default_shipping_price' => (float) $this->default_shipping_price,
            'display_order' => $this->display_order,
            'is_active' => $this->is_active,
            'is_system' => $this->is_system,
            'cities_count' => $this->whenCounted('cities'),
            'active_cities_count' => $this->when(
                $this->relationLoaded('activeCities'),
                fn () => $this->activeCities->count(),
            ),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
