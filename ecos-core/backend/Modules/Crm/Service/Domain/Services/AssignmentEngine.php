<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Services;

use Modules\Crm\Service\Domain\Models\AssignmentRule;
use Modules\Crm\Service\Domain\Models\Ticket;

/**
 * The Assignment Engine — routes a ticket to an agent or team.
 *
 * Rules are tried in order; the first whose predicate matches wins. A direct
 * rule names an agent/team; a round-robin rule spreads across a pool, picking
 * the least-loaded member (fewest open tickets) so work is shared fairly.
 * Deterministic and rule-based.
 *
 * @return array{assignee_id: ?int, team_id: ?string, rule: ?string}
 */
final class AssignmentEngine
{
    /** @return array{assignee_id: ?int, team_id: ?string, rule: ?string} */
    public function resolve(Ticket $ticket): array
    {
        $rules = AssignmentRule::query()
            ->where('company_id', $ticket->company_id)
            ->where('is_active', true)
            ->orderBy('order')
            ->orderBy('id')
            ->get();

        foreach ($rules as $rule) {
            if (! $this->matches($rule, $ticket)) {
                continue;
            }

            if ($rule->strategy === 'round_robin' && ! empty($rule->team_member_ids)) {
                return ['assignee_id' => $this->leastLoaded($ticket->company_id, $rule->team_member_ids), 'team_id' => $rule->team_id, 'rule' => $rule->name];
            }

            return ['assignee_id' => $rule->assignee_id !== null ? (int) $rule->assignee_id : null, 'team_id' => $rule->team_id, 'rule' => $rule->name];
        }

        return ['assignee_id' => null, 'team_id' => null, 'rule' => null];
    }

    private function matches(AssignmentRule $rule, Ticket $ticket): bool
    {
        return $this->matchField($rule->match_type, $ticket->type?->value)
            && $this->matchField($rule->match_category, $ticket->category)
            && $this->matchField($rule->match_channel, $ticket->channel)
            && $this->matchField($rule->match_priority, $ticket->priority?->value);
    }

    private function matchField(?string $ruleValue, ?string $ticketValue): bool
    {
        return $ruleValue === null || $ruleValue === $ticketValue;
    }

    /** @param list<int> $memberIds */
    private function leastLoaded(?string $companyId, array $memberIds): ?int
    {
        if ($memberIds === []) {
            return null;
        }

        $loads = Ticket::query()
            ->where('company_id', $companyId)
            ->whereIn('assignee_id', $memberIds)
            ->whereIn('status', ['new', 'open', 'pending', 'on_hold'])
            ->selectRaw('assignee_id, COUNT(*) as n')
            ->groupBy('assignee_id')
            ->pluck('n', 'assignee_id')
            ->all();

        $pick = null;
        $min = PHP_INT_MAX;
        foreach ($memberIds as $id) {
            $load = (int) ($loads[$id] ?? 0);
            if ($load < $min) {
                $min = $load;
                $pick = (int) $id;
            }
        }

        return $pick;
    }
}
