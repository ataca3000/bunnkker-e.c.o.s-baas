<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DistributionZoneResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name_ar' => $this->name_ar,
            'name_en' => $this->name_en,
            'description' => $this->description,
            'color' => $this->color,
            'is_active' => $this->is_active,
            'areas_count' => $this->whenCounted('areas', fn () => $this->areas_count),
            'areas' => $this->whenLoaded('areas', function () {
                return $this->areas->map(fn ($city) => [
                    'id' => $city->id,
                    'name_ar' => $city->name_ar,
                    'name_en' => $city->name_en,
                    'governorate_id' => $city->governorate_id,
                    'governorate_name_ar' => $city->governorate?->name_ar,
                    'governorate_name_en' => $city->governorate?->name_en,
                    'is_active' => $city->is_active,
                ]);
            }),
            'created_by' => $this->created_by,
            'updated_by' => $this->updated_by,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
