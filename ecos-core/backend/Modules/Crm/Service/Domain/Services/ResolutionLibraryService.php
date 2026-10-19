<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Services;

use Modules\Crm\Service\Domain\Enums\NoteVisibility;
use Modules\Crm\Service\Domain\Models\ResolutionTemplate;
use Modules\Crm\Service\Domain\Models\Ticket;

/**
 * The resolution library — reusable answers an agent applies to a case. Applying
 * one posts the resolution as a public note on the ticket and bumps its usage,
 * so the most effective resolutions rise to the top.
 */
final class ResolutionLibraryService
{
    public function __construct(private readonly TicketService $tickets) {}

    /** @param array<string, mixed> $data */
    public function create(string $companyId, array $data, ?int $actorId = null): ResolutionTemplate
    {
        return ResolutionTemplate::create([
            'company_id' => $companyId,
            'title' => $data['title'],
            'body' => $data['body'],
            'category' => $data['category'] ?? null,
            'applies_to_type' => $data['applies_to_type'] ?? null,
            'is_active' => true,
            'created_by' => $actorId,
        ]);
    }

    /** Apply a template to a ticket as a public resolution note. */
    public function apply(Ticket $ticket, ResolutionTemplate $template, ?int $actorId = null): void
    {
        $this->tickets->addNote($ticket, NoteVisibility::Public, $template->body, $actorId);
        $template->increment('usage_count');
        $this->tickets->recordEvent($ticket, 'resolution_applied', null, $template->title, null, $actorId);
    }
}
