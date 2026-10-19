<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Operations\Domain\Models\ResourcePool;

/**
 * @mixin ResourcePool
 */
class ResourcePoolResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'uuid' => $this->uuid,
            'company_id' => $this->company_id,

            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,

            'pool_type' => $this->pool_type->value,
            'pool_type_label' => $this->pool_type->label(),

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_tone' => $this->status->tone(),
            'status_reason' => $this->status_reason,
            'is_usable' => $this->isUsable(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),

            'dispatch_region' => $this->whenLoaded('region', fn () => $this->region === null ? null : [
                'id' => $this->region->uuid,
                'code' => $this->region->code,
                'name' => $this->region->name,
            ]),
            'service_area' => $this->whenLoaded('serviceArea', fn () => $this->serviceArea === null ? null : [
                'id' => $this->serviceArea->uuid,
                'code' => $this->serviceArea->code,
                'name' => $this->serviceArea->name,
            ]),

            'min_assignable' => $this->min_assignable,

            // Membership counts only. Readiness is fetched separately, because
            // it belongs to Fleet and Drivers and a list endpoint must not
            // imply otherwise.
            'member_count' => $this->whenCounted('members'),
            'active_member_count' => $this->whenCounted('activeMembers'),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
