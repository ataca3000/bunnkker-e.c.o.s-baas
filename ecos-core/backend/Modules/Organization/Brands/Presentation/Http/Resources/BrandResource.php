<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Organization\Brands\Domain\Models\Brand;

/** @mixin Brand */
final class BrandResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'company' => $this->whenLoaded('company', fn (): array => [
                'id' => $this->company->id,
                'code' => $this->company->code,
                'name' => $this->company->name,
            ]),
            'code' => $this->code,
            'name' => $this->name,
            'slug' => $this->slug,
            'logo' => $this->logo,
            'description' => $this->description,
            'is_active' => (bool) $this->is_active,
            'minimum_margin_pct' => $this->default_target_margin, // canonical Config OS name
            'default_target_margin' => $this->default_target_margin, // backwards-compat alias
            'default_markup' => $this->default_markup,
            'default_discount_pct' => $this->default_discount_pct,
            'channels_count' => (int) ($this->channels_count ?? 0),
            'active_channels_count' => (int) ($this->active_channels_count ?? 0),
            'products_count' => (int) ($this->products_count ?? 0),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
