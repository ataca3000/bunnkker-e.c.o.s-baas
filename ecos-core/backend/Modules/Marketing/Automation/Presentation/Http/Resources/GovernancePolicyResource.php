<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GovernancePolicyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'name' => $this->name,
            'description' => $this->description,
            'max_executions_per_customer_per_day' => $this->max_executions_per_customer_per_day,
            'max_executions_per_customer_per_workflow' => $this->max_executions_per_customer_per_workflow,
            'max_total_executions_per_day' => $this->max_total_executions_per_day,
            'quiet_hours_start' => $this->quiet_hours_start,
            'quiet_hours_end' => $this->quiet_hours_end,
            'quiet_hours_timezone' => $this->quiet_hours_timezone,
            'blacklisted_channels' => $this->blacklisted_channels,
            'opt_out_rules' => $this->opt_out_rules,
            'allowed_action_types' => $this->allowed_action_types,
            'requires_approval' => $this->requires_approval,
            'is_default' => $this->is_default,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
