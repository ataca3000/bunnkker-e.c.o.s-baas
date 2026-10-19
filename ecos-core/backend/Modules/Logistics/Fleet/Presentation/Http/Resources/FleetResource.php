<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Fleet\Domain\Models\Fleet;
use Modules\Logistics\Fleet\Domain\Models\FleetGroup;

/**
 * @mixin Fleet
 */
class FleetResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,

            // LOG-001 by reference. Null means an own fleet.
            'shipping_company_id' => $this->shipping_company_id,
            'is_own_fleet' => $this->isOwnFleet(),

            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'is_active' => $this->is_active,

            'groups' => $this->whenLoaded('groups', fn () => $this->groups->map(
                static fn (FleetGroup $group) => [
                    'id' => $group->uuid,
                    'uuid' => $group->uuid,
                    'code' => $group->code,
                    'name' => $group->name,
                    'is_active' => $group->is_active,
                    'unit_count' => $group->units_count ?? null,
                ]
            )->all()),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
