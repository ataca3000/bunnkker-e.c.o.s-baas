<?php

declare(strict_types=1);

namespace Modules\Logistics\Geography\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class CityAliasResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'city_id' => $this->city_id,
            'provider' => $this->provider,
            'alias' => $this->alias,
            'code' => $this->code,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
