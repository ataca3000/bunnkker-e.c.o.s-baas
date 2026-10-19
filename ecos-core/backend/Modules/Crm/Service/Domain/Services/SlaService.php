<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Crm\Service\Domain\Enums\TicketPriority;
use Modules\Crm\Service\Domain\Models\SlaPolicy;
use Modules\Crm\Service\Domain\Models\Ticket;

/**
 * SLA resolution — picks the policy for a ticket and derives its response/
 * resolution due-times. The clock is DERIVED from the policy's minutes; the
 * ticket stores the due-times, never a live countdown.
 */
final class SlaService
{
    /** The policy for a company + priority: a priority-specific one, else the default. */
    public function resolvePolicy(string $companyId, TicketPriority $priority): ?SlaPolicy
    {
        $base = SlaPolicy::query()->where('company_id', $companyId)->where('is_active', true);

        return (clone $base)->where('priority', $priority->value)->first()
            ?? (clone $base)->where('is_default', true)->first()
            ?? (clone $base)->whereNull('priority')->first();
    }

    /**
     * Stamp a ticket's SLA policy and due-times from its creation moment.
     */
    public function apply(Ticket $ticket, ?SlaPolicy $policy, ?Carbon $from = null): void
    {
        if ($policy === null) {
            return;
        }

        $from ??= $ticket->created_at ?? Carbon::now();

        $ticket->forceFill([
            'sla_policy_id' => $policy->id,
            'first_response_due_at' => $from->copy()->addMinutes($policy->first_response_minutes),
            'resolution_due_at' => $from->copy()->addMinutes($policy->resolution_minutes),
        ]);
    }
}
