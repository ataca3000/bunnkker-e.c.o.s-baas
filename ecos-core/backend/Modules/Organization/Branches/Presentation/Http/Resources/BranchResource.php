<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Organization\Branches\Domain\Models\Branch;

/**
 * @mixin Branch
 */
final class BranchResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
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
            'phone' => $this->phone,
            'email' => $this->email,
            'manager_name' => $this->manager_name,
            'address' => $this->address,
            'city' => $this->city,
            'country' => $this->country,
            'is_head_office' => (bool) $this->is_head_office,
            'is_active' => (bool) $this->is_active,
            // Coverage assignment fields
            'default_warehouse_id' => $this->default_warehouse_id,
            'default_warehouse' => $this->whenLoaded('defaultWarehouse', fn (): ?array => $this->defaultWarehouse ? [
                'id'   => $this->defaultWarehouse->id,
                'code' => $this->defaultWarehouse->code,
                'name' => $this->defaultWarehouse->name,
            ] : null),
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            // Coverage areas — only included when the relation is eager-loaded
            'coverage_areas' => $this->whenLoaded('coverageAreas', fn () => CoverageAreaResource::collection($this->coverageAreas)),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
