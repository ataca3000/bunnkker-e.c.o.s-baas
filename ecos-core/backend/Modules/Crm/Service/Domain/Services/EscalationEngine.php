<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Crm\Service\Domain\Models\EscalationRule;
use Modules\Crm\Service\Domain\Models\Ticket;

/**
 * The Escalation Engine — detects SLA breaches and idle cases and escalates them.
 *
 * A deterministic sweep: any open ticket past its first-response or resolution
 * due-time (and not met) is marked breached and escalated per the matching rule;
 * an idle ticket is escalated too. It writes only ticket state and the append-
 * only event log. Intended to run on a schedule; exposed for on-demand runs.
 */
final class EscalationEngine
{
    private const OPEN = ['new', 'open', 'pending', 'on_hold'];

    public function __construct(private readonly TicketService $tickets) {}

    /** @return array<string, int> */
    public function evaluate(string $companyId, ?Carbon $now = null): array
    {
        $now ??= Carbon::now();
        $summary = ['first_response_breaches' => 0, 'resolution_breaches' => 0, 'idle_escalations' => 0, 'escalated' => 0];

        // First-response breaches.
        foreach ($this->due($companyId, 'first_response_due_at', 'first_responded_at', 'first_response_breached', $now) as $ticket) {
            $this->tickets->markBreach($ticket, 'first_response');
            $summary['first_response_breaches']++;
            $summary['escalated'] += $this->applyRule($ticket, 'first_response_breach') ? 1 : 0;
        }

        // Resolution breaches.
        foreach ($this->due($companyId, 'resolution_due_at', 'resolved_at', 'resolution_breached', $now) as $ticket) {
            $this->tickets->markBreach($ticket, 'resolution');
            $summary['resolution_breaches']++;
            $summary['escalated'] += $this->applyRule($ticket, 'resolution_breach') ? 1 : 0;
        }

        // Idle cases.
        foreach ($this->idleRules($companyId) as $rule) {
            $cutoff = $now->copy()->subMinutes((int) $rule->idle_minutes);
            $stale = Ticket::query()
                ->where('company_id', $companyId)
                ->whereIn('status', self::OPEN)
                ->when($rule->match_priority !== null, fn ($q) => $q->where('priority', $rule->match_priority))
                ->whereDoesntHave('events', fn ($e) => $e->where('occurred_at', '>=', $cutoff))
                ->get();

            foreach ($stale as $ticket) {
                $this->tickets->escalate($ticket, 'idle > '.$rule->idle_minutes.'m', $rule->reassign_to_user_id !== null ? (int) $rule->reassign_to_user_id : null, $rule->reassign_to_team_id, null);
                $summary['idle_escalations']++;
                $summary['escalated']++;
            }
        }

        return $summary;
    }

    /** @return \Illuminate\Support\Collection<int, Ticket> */
    private function due(string $companyId, string $dueColumn, string $metColumn, string $breachedColumn, Carbon $now)
    {
        return Ticket::query()
            ->where('company_id', $companyId)
            ->whereIn('status', self::OPEN)
            ->whereNotNull($dueColumn)
            ->where($dueColumn, '<', $now)
            ->whereNull($metColumn)
            ->where($breachedColumn, false)
            ->get();
    }

    private function applyRule(Ticket $ticket, string $trigger): bool
    {
        $rule = EscalationRule::query()
            ->where('company_id', $ticket->company_id)
            ->where('is_active', true)
            ->where('trigger', $trigger)
            ->where(fn ($q) => $q->whereNull('match_priority')->orWhere('match_priority', $ticket->priority?->value))
            ->orderByRaw('CASE WHEN match_priority IS NULL THEN 1 ELSE 0 END')
            ->first();

        if ($rule === null) {
            return false;
        }

        $this->tickets->escalate(
            $ticket, $trigger,
            $rule->reassign_to_user_id !== null ? (int) $rule->reassign_to_user_id : null,
            $rule->reassign_to_team_id,
        );

        return true;
    }

    /** @return \Illuminate\Support\Collection<int, EscalationRule> */
    private function idleRules(string $companyId)
    {
        return EscalationRule::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->where('trigger', 'idle')
            ->whereNotNull('idle_minutes')
            ->get();
    }
}
