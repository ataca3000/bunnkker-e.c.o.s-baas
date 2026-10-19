<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Network\Domain\Models\ServiceArea;
use Modules\Logistics\Network\Domain\Models\ServiceAreaMember;

/**
 * @mixin ServiceArea
 *
 * Member names are resolved LIVE from V1 geography, never stored — see
 * ServiceAreaMember::targetName(). That is Directive 8 visible in the API
 * surface as well as the schema.
 */
class ServiceAreaResource extends JsonResource
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

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_tone' => $this->status->tone(),
            'status_reason' => $this->status_reason,
            'accepts_commitments' => $this->acceptsCommitments(),
            'is_serving' => $this->isServing(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),

            'default_lead_time_hours' => $this->default_lead_time_hours,
            'priority' => $this->priority,
            'color' => $this->color,

            'dispatch_region' => $this->whenLoaded('region', fn () => $this->region === null ? null : [
                'id' => $this->region->uuid,
                'code' => $this->region->code,
                'name' => $this->region->name,
            ]),

            'member_count' => $this->when(
                $this->members_count !== null,
                fn () => (int) $this->members_count,
            ),
            'has_coverage' => $this->when(
                $this->relationLoaded('members'),
                fn () => $this->members->where('is_excluded', false)->isNotEmpty(),
            ),

            'members' => $this->whenLoaded('members', fn () => $this->members->map(
                static fn (ServiceAreaMember $member) => [
                    'id' => $member->id,
                    'member_type' => $member->member_type->value,
                    'member_type_label' => $member->member_type->label(),
                    'member_id' => $member->member_id,
                    // Resolved live from V1 — never a stored copy.
                    'name' => $member->targetName(),
                    'is_excluded' => $member->is_excluded,
                ]
            )->all()),

            'coverage_rules' => $this->whenLoaded('coverageRules', fn () => $this->coverageRules->map(
                static fn ($rule) => [
                    'id' => $rule->uuid,
                    'service_level' => $rule->level?->name,
                    'service_level_code' => $rule->level?->code,
                    'cutoff_time' => $rule->cutoff_time,
                    'lead_time_hours' => $rule->lead_time_hours,
                    'surcharge' => $rule->surcharge !== null ? (float) $rule->surcharge : null,
                    'currency' => $rule->currency,
                    'is_active' => $rule->is_active,
                ]
            )->all()),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
