<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Service\Domain\Models\ResolutionTemplate;
use Modules\Crm\Service\Domain\Models\Ticket;
use Modules\Crm\Service\Domain\Services\ResolutionLibraryService;

/** The resolution library — canned resolutions and applying them to a ticket. */
class ResolutionLibraryController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly ResolutionLibraryService $library) {}

    public function index(Request $request): JsonResponse
    {
        $rows = ResolutionTemplate::query()
            ->where('company_id', $this->companyId($request))
            ->where('is_active', true)
            ->when($request->filled('applies_to_type'), fn ($q) => $q->where('applies_to_type', $request->string('applies_to_type')))
            ->orderByDesc('usage_count')->limit(100)->get()
            ->map(fn (ResolutionTemplate $t) => ['id' => $t->id, 'title' => $t->title, 'category' => $t->category, 'applies_to_type' => $t->applies_to_type, 'usage_count' => $t->usage_count]);

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string'],
            'category' => ['nullable', 'string', 'max:80'],
            'applies_to_type' => ['nullable', 'string', 'max:20'],
        ]);

        $template = $this->library->create($this->companyId($request), $v, $this->actorId($request));

        return response()->json(['data' => ['id' => $template->id, 'title' => $template->title]], 201);
    }

    public function apply(Request $request, string $ticketId): JsonResponse
    {
        $v = $request->validate(['template_id' => ['required', 'string']]);

        $ticket = Ticket::query()->where('company_id', $this->companyId($request))->where('id', $ticketId)->firstOrFail();
        $template = ResolutionTemplate::query()->where('company_id', $this->companyId($request))->where('id', $v['template_id'])->firstOrFail();

        $this->library->apply($ticket, $template, $this->actorId($request));

        return response()->json(['message' => 'Resolution applied to '.$ticket->ticket_number.'.']);
    }
}
