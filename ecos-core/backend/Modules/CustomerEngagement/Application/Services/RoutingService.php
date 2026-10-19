<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Services;

use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\RoutingRule;

class RoutingService
{
    public function autoRoute(Conversation $conversation): void
    {
        $rules = RoutingRule::query()
            ->where('company_id', $conversation->company_id)
            ->where('is_active', true)
            ->orderBy('priority')
            ->get();

        $conversationData = [
            'channel' => $conversation->provider,
            'language' => $conversation->language,
            'country' => $conversation->country,
            'is_vip' => $conversation->is_vip ?? false,
            'campaign_id' => $conversation->campaign_id,
        ];

        foreach ($rules as $rule) {
            if (! $rule->matches($conversationData)) {
                continue;
            }

            $update = [];

            if ($rule->assign_to_user_id) {
                $update['assigned_employee_id'] = $rule->assign_to_user_id;
                $update['status'] = 'assigned';
            }
            if ($rule->assign_to_team_id) {
                $update['assigned_team_id'] = $rule->assign_to_team_id;
            }
            if ($rule->sla_policy_id && $rule->apply_sla_policy) {
                $update['sla_policy_id'] = $rule->sla_policy_id;
            }
            if ($rule->set_priority) {
                $update['priority'] = $rule->set_priority;
            }

            if (! empty($update)) {
                $conversation->update($update);
            }
            break; // First matching rule wins
        }
    }

    public function paginate(array $filters, int $perPage = 20): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        return RoutingRule::query()
            ->when(! empty($filters['company_id']), fn ($q) => $q->where('company_id', $filters['company_id']))
            ->orderBy('priority')
            ->paginate($perPage);
    }

    public function create(array $data): RoutingRule
    {
        return RoutingRule::create($data);
    }

    public function update(RoutingRule $rule, array $data): RoutingRule
    {
        $rule->update($data);

        return $rule->fresh();
    }

    public function delete(RoutingRule $rule): void
    {
        $rule->delete();
    }
}
