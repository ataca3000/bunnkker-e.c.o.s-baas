<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Crm\Service\Domain\Enums\NoteVisibility;
use Modules\Crm\Service\Domain\Enums\TicketPriority;
use Modules\Crm\Service\Domain\Enums\TicketStatus;
use Modules\Crm\Service\Domain\Enums\TicketType;
use Modules\Crm\Service\Domain\Exceptions\ServiceException;
use Modules\Crm\Service\Domain\Models\Ticket;
use Modules\Crm\Service\Domain\Models\TicketAttachment;
use Modules\Crm\Service\Domain\Models\TicketEvent;
use Modules\Crm\Service\Domain\Models\TicketNote;

/**
 * The ticket workflow — the CRM's case engine.
 *
 * ┌─ RESOLUTION WORKFLOW · SLA CLOCK · APPEND-ONLY AUDIT ───────────────────┐
 * │ Creating a case stamps its SLA due-times and runs the assignment engine;   │
 * │ every status move is validated against the workflow map; every meaningful  │
 * │ change is recorded as an immutable ticket event. The CRM owns the case and  │
 * │ references operational systems only by opaque id.                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class TicketService
{
    public function __construct(
        private readonly SlaService $sla,
        private readonly AssignmentEngine $assignment,
    ) {}

    /** @param array<string, mixed> $data */
    public function create(string $companyId, string $customerId, TicketType $type, array $data, ?int $actorId = null): Ticket
    {
        $priority = isset($data['priority']) ? TicketPriority::from((string) $data['priority']) : TicketPriority::Normal;

        return DB::transaction(function () use ($companyId, $customerId, $type, $data, $priority, $actorId): Ticket {
            $ticket = Ticket::create([
                'company_id' => $companyId,
                'customer_id' => $customerId,
                'ticket_number' => $this->number(),
                'type' => $type->value,
                'subject' => $data['subject'],
                'description' => $data['description'] ?? null,
                'status' => TicketStatus::New->value,
                'priority' => $priority->value,
                'channel' => $data['channel'] ?? null,
                'category' => $data['category'] ?? null,
                'source_reference' => $data['source_reference'] ?? null,
                'tags' => $data['tags'] ?? null,
                'created_by' => $actorId,
            ]);

            // SLA clock.
            $this->sla->apply($ticket, $this->sla->resolvePolicy($companyId, $priority), $ticket->created_at);
            $ticket->save();

            // Assignment engine.
            $routing = $this->assignment->resolve($ticket);
            if ($routing['assignee_id'] !== null || $routing['team_id'] !== null) {
                $ticket->update(['assignee_id' => $routing['assignee_id'], 'team_id' => $routing['team_id']]);
            }

            $this->recordEvent($ticket, 'created', null, $type->value, null, $actorId);
            if ($routing['assignee_id'] !== null || $routing['team_id'] !== null) {
                $this->recordEvent($ticket, 'assigned', null, (string) ($routing['assignee_id'] ?? $routing['team_id']), $routing['rule'], $actorId);
            }

            return $ticket->refresh();
        });
    }

    /** Move a ticket through the resolution workflow. */
    public function transition(Ticket $ticket, TicketStatus $target, ?int $actorId = null, ?string $note = null): Ticket
    {
        $from = $ticket->status;

        if ($from->isTerminal()) {
            throw ServiceException::ticketTerminal($ticket->ticket_number);
        }
        if (! $from->canTransitionTo($target)) {
            throw ServiceException::invalidTransition($from->value, $target->value);
        }

        return DB::transaction(function () use ($ticket, $from, $target, $actorId, $note): Ticket {
            $changes = ['status' => $target->value];
            $eventType = 'status_changed';

            if ($target === TicketStatus::Resolved) {
                $changes['resolved_at'] = Carbon::now();
                $eventType = 'resolved';
            } elseif ($target === TicketStatus::Closed) {
                $changes['closed_at'] = Carbon::now();
            } elseif ($target === TicketStatus::Open && $from->isTerminal() === false && ($from === TicketStatus::Resolved || $from === TicketStatus::Closed)) {
                $changes['reopened_count'] = $ticket->reopened_count + 1;
                $changes['resolved_at'] = null;
                $changes['closed_at'] = null;
                $eventType = 'reopened';
            }

            $ticket->update($changes);
            $this->recordEvent($ticket, $eventType, $from->value, $target->value, $note, $actorId);

            return $ticket->refresh();
        });
    }

    public function assign(Ticket $ticket, ?int $assigneeId, ?string $teamId = null, ?int $actorId = null): Ticket
    {
        $from = $ticket->assignee_id;
        $ticket->update(['assignee_id' => $assigneeId, 'team_id' => $teamId]);
        $this->recordEvent($ticket, 'assigned', $from !== null ? (string) $from : null, $assigneeId !== null ? (string) $assigneeId : ($teamId ?? null), null, $actorId);

        return $ticket->refresh();
    }

    public function addNote(Ticket $ticket, NoteVisibility $visibility, string $body, ?int $authorId = null): TicketNote
    {
        return DB::transaction(function () use ($ticket, $visibility, $body, $authorId): TicketNote {
            $note = $ticket->notes()->create(['visibility' => $visibility->value, 'body' => $body, 'author_id' => $authorId]);

            // First agent response stops the response clock.
            if ($authorId !== null && $ticket->first_responded_at === null) {
                $ticket->update(['first_responded_at' => Carbon::now()]);
                $this->recordEvent($ticket, 'first_response', null, null, null, $authorId);
            }

            return $note;
        });
    }

    /** @param array<string, mixed> $data */
    public function addAttachment(Ticket $ticket, array $data, ?int $uploadedBy = null): TicketAttachment
    {
        return $ticket->attachments()->create([
            'name' => $data['name'],
            'file_path' => $data['file_path'],
            'mime_type' => $data['mime_type'] ?? null,
            'size_bytes' => $data['size_bytes'] ?? null,
            'visibility' => $data['visibility'] ?? 'internal',
            'uploaded_by' => $uploadedBy,
        ]);
    }

    /** Escalate a ticket a level, optionally reassigning to a target. */
    public function escalate(Ticket $ticket, string $reason, ?int $toUserId = null, ?string $toTeamId = null, ?int $actorId = null): Ticket
    {
        return DB::transaction(function () use ($ticket, $reason, $toUserId, $toTeamId, $actorId): Ticket {
            $ticket->update([
                'escalation_level' => $ticket->escalation_level + 1,
                'escalated_at' => Carbon::now(),
                'assignee_id' => $toUserId ?? $ticket->assignee_id,
                'team_id' => $toTeamId ?? $ticket->team_id,
            ]);
            $this->recordEvent($ticket, 'escalated', (string) ($ticket->escalation_level - 1), (string) $ticket->escalation_level, $reason, $actorId);

            return $ticket->refresh();
        });
    }

    public function markBreach(Ticket $ticket, string $kind): void
    {
        $ticket->update([$kind === 'first_response' ? 'first_response_breached' : 'resolution_breached' => true]);
        $this->recordEvent($ticket, 'sla_breach', null, $kind, null, null);
    }

    public function recordEvent(Ticket $ticket, string $type, ?string $from, ?string $to, ?string $note, ?int $actorId): TicketEvent
    {
        return TicketEvent::create([
            'ticket_id' => $ticket->id,
            'event_type' => $type,
            'from_value' => $from,
            'to_value' => $to,
            'note' => $note,
            'actor_id' => $actorId,
            'occurred_at' => Carbon::now(),
        ]);
    }

    private function number(): string
    {
        do {
            $number = 'TKT-'.strtoupper(substr(str_replace('-', '', (string) Str::uuid()), 0, 8));
        } while (Ticket::where('ticket_number', $number)->exists());

        return $number;
    }
}
