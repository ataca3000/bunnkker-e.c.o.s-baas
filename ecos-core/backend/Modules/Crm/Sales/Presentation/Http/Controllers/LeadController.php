<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Sales\Domain\Enums\LeadStatus;
use Modules\Crm\Sales\Domain\Models\Lead;
use Modules\Crm\Sales\Domain\Services\LeadService;

/** Leads and their conversion into customers + opportunities. */
class LeadController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly LeadService $leads) {}

    public function index(Request $request): JsonResponse
    {
        $rows = Lead::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->latest('created_at')->limit(100)->get()
            ->map(fn (Lead $l) => $this->payload($l));

        return response()->json(['data' => $rows]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->lead($request, $id))]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:200'],
            'company_name' => ['nullable', 'string', 'max:200'],
            'source' => ['nullable', 'string', 'max:60'],
            'score' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string'],
            'tags' => ['nullable', 'array'],
        ]);

        return response()->json(['data' => $this->payload($this->leads->create($this->companyId($request), $v, $this->actorId($request)))], 201);
    }

    public function setStatus(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['status' => ['required', Rule::in(LeadStatus::values())]]);
        $lead = $this->leads->setStatus($this->lead($request, $id), LeadStatus::from($v['status']));

        return response()->json(['data' => $this->payload($lead)]);
    }

    public function convert(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'opportunity_name' => ['nullable', 'string', 'max:200'],
            'amount' => ['nullable', 'numeric'],
            'expected_close_date' => ['nullable', 'date'],
            'existing_customer_id' => ['nullable', 'string'],
        ]);

        $result = $this->leads->convert(
            $this->lead($request, $id),
            ['name' => $v['opportunity_name'] ?? null, 'amount' => $v['amount'] ?? 0, 'expected_close_date' => $v['expected_close_date'] ?? null],
            $this->actorId($request),
            $v['existing_customer_id'] ?? null,
        );

        return response()->json(['data' => [
            'lead' => $this->payload($result['lead']),
            'customer_id' => $result['customer_id'],
            'opportunity_id' => $result['opportunity']->id,
        ]]);
    }

    private function lead(Request $request, string $id): Lead
    {
        return Lead::query()->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(Lead $l): array
    {
        return [
            'id' => $l->id, 'name' => $l->name, 'phone' => $l->phone, 'email' => $l->email,
            'company_name' => $l->company_name, 'source' => $l->source, 'status' => $l->status->value,
            'score' => $l->score, 'owner_id' => $l->owner_id, 'customer_id' => $l->customer_id,
            'converted_opportunity_id' => $l->converted_opportunity_id, 'converted_at' => $l->converted_at?->toIso8601String(),
        ];
    }
}
