<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Organization\Branches\Domain\Models\BranchCoverageArea;

/**
 * @mixin BranchCoverageArea
 */
final class CoverageAreaResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'branch_id'             => $this->branch_id,
            'master_governorate_id' => $this->master_governorate_id,
            'master_zone_id'        => $this->master_zone_id,
            'priority'              => $this->priority,
            'is_active'             => (bool) $this->is_active,
            'governorate' => $this->whenLoaded('governorate', fn (): ?array => $this->governorate ? [
                'id'      => $this->governorate->id,
                'name'    => $this->governorate->name,
                'name_ar' => $this->governorate->name_ar,
            ] : null),
            'zone' => $this->whenLoaded('zone', fn (): ?array => $this->zone ? [
                'id'   => $this->zone->id,
                'name' => $this->zone->name,
            ] : null),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
