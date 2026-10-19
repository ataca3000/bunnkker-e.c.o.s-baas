<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class RoutingRuleResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'name' => $this->name,
            'priority' => $this->priority,
            'routing_type' => $this->routing_type,
            'conditions' => $this->conditions,
            'assign_to_user_id' => $this->assign_to_user_id,
            'assign_to_team_id' => $this->assign_to_team_id,
            'apply_sla_policy' => $this->apply_sla_policy,
            'sla_policy_id' => $this->sla_policy_id,
            'set_priority' => $this->set_priority,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
