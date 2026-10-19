<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Service\Domain\Enums\TicketStatus;
use Modules\Crm\Service\Domain\Enums\TicketType;
use Modules\Crm\Service\Domain\Models\Ticket;
use Modules\Crm\Service\Domain\Services\TicketService;

/**
 * Service tickets — the case lifecycle. Create, browse, work the resolution
 * workflow, assign and escalate. The CRM owns the case; operational systems are
 * referenced only by opaque id in source_reference.
 */
class TicketController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly TicketService $tickets) {}

    public function index(Request $request): JsonResponse
    {
        $rows = Ticket::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('customer_id'), fn ($q) => $q->where('customer_id', $request->string('customer_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->when($request->filled('assignee_id'), fn ($q) => $q->where('assignee_id', $request->integer('assignee_id')))
            ->latest('created_at')->limit(100)->get()
            ->map(fn (Ticket $t) => $this->summary($t));

        return response()->json(['data' => $rows]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $ticket = $this->ticket($request, $id)->load(['notes', 'attachments', 'events' => fn ($q) => $q->orderBy('occurred_at')]);

        return response()->json(['data' => $this->detail($ticket)]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'string'],
            'type' => ['nullable', Rule::in(TicketType::values())],
            'subject' => ['required', 'string', 'max:250'],
            'description' => ['nullable', 'string'],
            'priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'channel' => ['nullable', 'string', 'max:20'],
            'category' => ['nullable', 'string', 'max:60'],
            'source_reference' => ['nullable', 'array'],
            'tags' => ['nullable', 'array'],
        ]);

        $customer = $this->customer($request, $validated['customer_id']); // scopes to company

        $ticket = $this->tickets->create(
            $this->companyId($request), (string) $customer->id,
            TicketType::from($validated['type'] ?? 'ticket'), $validated, $this->actorId($request),
        );

        return response()->json(['data' => $this->summary($ticket)], 201);
    }

    public function transition(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(array_map(fn ($s) => $s->value, TicketStatus::cases()))],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $ticket = $this->tickets->transition($this->ticket($request, $id), TicketStatus::from($validated['status']), $this->actorId($request), $validated['note'] ?? null);

        return response()->json(['data' => $this->summary($ticket)]);
    }

    public function assign(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate(['assignee_id' => ['nullable', 'integer'], 'team_id' => ['nullable', 'string']]);
        $ticket = $this->tickets->assign($this->ticket($request, $id), $validated['assignee_id'] ?? null, $validated['team_id'] ?? null, $this->actorId($request));

        return response()->json(['data' => $this->summary($ticket)]);
    }

    public function escalate(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:200'],
            'to_user_id' => ['nullable', 'integer'],
            'to_team_id' => ['nullable', 'string'],
        ]);
        $ticket = $this->tickets->escalate($this->ticket($request, $id), $validated['reason'], $validated['to_user_id'] ?? null, $validated['to_team_id'] ?? null, $this->actorId($request));

        return response()->json(['data' => $this->summary($ticket)]);
    }

    private function ticket(Request $request, string $id): Ticket
    {
        return Ticket::query()->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function summary(Ticket $t): array
    {
        return [
            'id' => $t->id,
            'ticket_number' => $t->ticket_number,
            'customer_id' => $t->customer_id,
            'type' => $t->type->value,
            'subject' => $t->subject,
            'status' => $t->status->value,
            'priority' => $t->priority->value,
            'assignee_id' => $t->assignee_id,
            'team_id' => $t->team_id,
            'first_response_due_at' => $t->first_response_due_at?->toIso8601String(),
            'resolution_due_at' => $t->resolution_due_at?->toIso8601String(),
            'first_response_breached' => (bool) $t->first_response_breached,
            'resolution_breached' => (bool) $t->resolution_breached,
            'escalation_level' => $t->escalation_level,
            'resolved_at' => $t->resolved_at?->toIso8601String(),
            'source_reference' => $t->source_reference,
        ];
    }

    /** @return array<string, mixed> */
    private function detail(Ticket $t): array
    {
        return $this->summary($t) + [
            'description' => $t->description,
            'notes' => $t->notes->map(fn ($n) => ['id' => $n->id, 'visibility' => $n->visibility->value, 'body' => $n->body, 'author_id' => $n->author_id, 'at' => $n->created_at?->toIso8601String()])->all(),
            'attachments' => $t->attachments->map(fn ($a) => ['id' => $a->id, 'name' => $a->name, 'visibility' => $a->visibility])->all(),
            'events' => $t->events->map(fn ($e) => ['type' => $e->event_type, 'from' => $e->from_value, 'to' => $e->to_value, 'note' => $e->note, 'actor_id' => $e->actor_id, 'at' => $e->occurred_at?->toIso8601String()])->all(),
        ];
    }
}
