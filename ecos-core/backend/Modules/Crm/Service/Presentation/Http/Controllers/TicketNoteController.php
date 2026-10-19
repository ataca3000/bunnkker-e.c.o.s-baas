<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Service\Domain\Enums\NoteVisibility;
use Modules\Crm\Service\Domain\Models\Ticket;
use Modules\Crm\Service\Domain\Services\TicketService;

/** Internal and public notes, and attachments, on a ticket. */
class TicketNoteController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly TicketService $tickets) {}

    public function addNote(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'visibility' => ['required', Rule::in(['internal', 'public'])],
            'body' => ['required', 'string'],
        ]);

        $note = $this->tickets->addNote($this->ticket($request, $id), NoteVisibility::from($validated['visibility']), $validated['body'], $this->actorId($request));

        return response()->json(['data' => ['id' => $note->id, 'visibility' => $note->visibility->value]], 201);
    }

    public function addAttachment(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'file_path' => ['required', 'string', 'max:500'],
            'mime_type' => ['nullable', 'string', 'max:120'],
            'size_bytes' => ['nullable', 'integer'],
            'visibility' => ['nullable', Rule::in(['internal', 'public'])],
        ]);

        $attachment = $this->tickets->addAttachment($this->ticket($request, $id), $validated, $this->actorId($request));

        return response()->json(['data' => ['id' => $attachment->id, 'name' => $attachment->name]], 201);
    }

    private function ticket(Request $request, string $id): Ticket
    {
        return Ticket::query()->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }
}
