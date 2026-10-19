<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Sales\Domain\Models\Opportunity;
use Modules\Crm\Sales\Domain\Models\PipelineStage;
use Modules\Crm\Sales\Domain\Services\OpportunityService;

/** Opportunities and the sales pipeline. */
class OpportunityController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly OpportunityService $opportunities) {}

    public function index(Request $request): JsonResponse
    {
        $rows = Opportunity::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('customer_id'), fn ($q) => $q->where('customer_id', $request->string('customer_id')))
            ->latest('created_at')->limit(100)->get()
            ->map(fn (Opportunity $o) => $this->payload($o));

        return response()->json(['data' => $rows]);
    }

    public function forecast(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->opportunities->forecast($this->companyId($request))]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:200'],
            'customer_id' => ['nullable', 'string'],
            'pipeline_id' => ['nullable', 'string'],
            'amount' => ['nullable', 'numeric'],
            'currency' => ['nullable', 'string', 'size:3'],
            'expected_close_date' => ['nullable', 'date'],
            'source' => ['nullable', 'string', 'max:60'],
        ]);

        return response()->json(['data' => $this->payload($this->opportunities->create($this->companyId($request), $v, $this->actorId($request)))], 201);
    }

    public function moveStage(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['stage_id' => ['required', 'string']]);
        $opportunity = $this->opportunity($request, $id);
        $stage = PipelineStage::query()->where('id', $v['stage_id'])->firstOrFail();

        return response()->json(['data' => $this->payload($this->opportunities->moveToStage($opportunity, $stage))]);
    }

    public function win(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['order_reference' => ['nullable', 'string', 'max:64']]);
        $opportunity = $this->opportunities->win($this->opportunity($request, $id), $v['order_reference'] ?? null, $this->actorId($request));

        return response()->json(['data' => $this->payload($opportunity)]);
    }

    public function lose(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['reason' => ['required', 'string', 'max:200']]);
        $opportunity = $this->opportunities->lose($this->opportunity($request, $id), $v['reason'], $this->actorId($request));

        return response()->json(['data' => $this->payload($opportunity)]);
    }

    public function reopen(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->opportunities->reopen($this->opportunity($request, $id)))]);
    }

    private function opportunity(Request $request, string $id): Opportunity
    {
        return Opportunity::query()->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(Opportunity $o): array
    {
        return [
            'id' => $o->id, 'name' => $o->name, 'customer_id' => $o->customer_id, 'pipeline_id' => $o->pipeline_id,
            'stage_id' => $o->stage_id, 'amount' => (float) $o->amount, 'currency' => $o->currency,
            'probability' => $o->probability, 'weighted_value' => $o->weightedValue(), 'status' => $o->status->value,
            'expected_close_date' => $o->expected_close_date?->toDateString(), 'order_reference' => $o->order_reference,
            'won_at' => $o->won_at?->toIso8601String(), 'lost_at' => $o->lost_at?->toIso8601String(), 'lost_reason' => $o->lost_reason,
        ];
    }
}
