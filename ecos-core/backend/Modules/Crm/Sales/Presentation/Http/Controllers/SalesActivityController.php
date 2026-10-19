<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Sales\Domain\Enums\SalesActivityType;
use Modules\Crm\Sales\Domain\Models\SalesActivity;
use Modules\Crm\Sales\Domain\Services\SalesActivityService;

/** Sales activities, reminders and follow-ups on leads and opportunities. */
class SalesActivityController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly SalesActivityService $activities) {}

    public function index(Request $request): JsonResponse
    {
        $rows = SalesActivity::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('subject_type'), fn ($q) => $q->where('subject_type', $request->string('subject_type')))
            ->when($request->filled('subject_id'), fn ($q) => $q->where('subject_id', $request->string('subject_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->latest('created_at')->limit(200)->get()
            ->map(fn (SalesActivity $a) => $this->payload($a));

        return response()->json(['data' => $rows]);
    }

    public function due(Request $request): JsonResponse
    {
        $rows = $this->activities->due($this->companyId($request), null, $request->filled('assignee_id') ? $request->integer('assignee_id') : null)
            ->map(fn (SalesActivity $a) => $this->payload($a));

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'subject_type' => ['required', Rule::in(['lead', 'opportunity'])],
            'subject_id' => ['required', 'string'],
            'activity_type' => ['required', Rule::in(SalesActivityType::values())],
            'title' => ['required', 'string', 'max:200'],
            'body' => ['nullable', 'string'],
            'due_at' => ['nullable', 'date'],
            'remind_at' => ['nullable', 'date'],
            'assignee_id' => ['nullable', 'integer'],
        ]);

        $activity = $this->activities->create($this->companyId($request), $v['subject_type'], $v['subject_id'], SalesActivityType::from($v['activity_type']), $v, $this->actorId($request));

        return response()->json(['data' => $this->payload($activity)], 201);
    }

    public function complete(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->activities->complete($this->activity($request, $id)))]);
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->activities->cancel($this->activity($request, $id)))]);
    }

    private function activity(Request $request, string $id): SalesActivity
    {
        return SalesActivity::query()->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(SalesActivity $a): array
    {
        return [
            'id' => $a->id, 'subject_type' => $a->subject_type, 'subject_id' => $a->subject_id,
            'activity_type' => $a->activity_type->value, 'title' => $a->title, 'status' => $a->status,
            'due_at' => $a->due_at?->toIso8601String(), 'remind_at' => $a->remind_at?->toIso8601String(),
            'completed_at' => $a->completed_at?->toIso8601String(), 'assignee_id' => $a->assignee_id,
        ];
    }
}
