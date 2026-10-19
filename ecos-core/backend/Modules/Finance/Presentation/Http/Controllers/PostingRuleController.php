<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Finance\Integration\Domain\Enums\BusinessEventType;
use Modules\Finance\Integration\Domain\Services\PostingRuleRegistry;
use Modules\Finance\Posting\Domain\Models\PostingRule;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Posting rules — the configuration that maps a business event to a balanced set
 * of journal legs. A company may override a global template with its own rule.
 * Rules describe a journal; they never write the ledger.
 */
class PostingRuleController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly PostingRuleRegistry $registry) {}

    public function index(Request $request): JsonResponse
    {
        $rules = $this->registry->all($this->companyId($request))
            ->map(fn (PostingRule $r) => $this->payload($r));

        return response()->json([
            'data' => $rules,
            'events' => BusinessEventType::values(),
        ]);
    }

    public function show(Request $request, string $uuid): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->find($request, $uuid))]);
    }

    /** Create a company-specific override rule. */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', Rule::in(BusinessEventType::values())],
            'description' => ['nullable', 'string', 'max:500'],
            'legs' => ['required', 'array', 'min:2'],
            'legs.*.side' => ['required', Rule::in(['debit', 'credit'])],
            'legs.*.role' => ['required', 'string', 'max:60'],
            'legs.*.source' => ['required', 'string', 'max:40'],
        ]);

        $rule = PostingRule::create([
            'company_id' => $this->companyId($request),
            'code' => $validated['code'],
            'event_type' => $validated['code'],
            'description' => $validated['description'] ?? null,
            'legs' => $validated['legs'],
            'is_active' => true,
        ]);

        return response()->json(['data' => $this->payload($rule)], 201);
    }

    public function setActive(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate(['is_active' => ['required', 'boolean']]);
        $rule = $this->find($request, $uuid);

        // Only a company's own rule may be toggled here — templates are global.
        abort_if($rule->company_id === null, 422, 'A global template rule cannot be toggled per company; create an override instead.');

        $rule->update(['is_active' => $validated['is_active']]);

        return response()->json(['data' => $this->payload($rule->refresh())]);
    }

    private function find(Request $request, string $uuid): PostingRule
    {
        return PostingRule::query()
            ->where('uuid', $uuid)
            ->where(function ($q) use ($request): void {
                $q->where('company_id', $this->companyId($request))->orWhereNull('company_id');
            })
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(PostingRule $r): array
    {
        return [
            'id' => $r->uuid,
            'code' => $r->code,
            'event_type' => $r->event_type,
            'scope' => $r->company_id === null ? 'template' : 'company',
            'description' => $r->description,
            'legs' => $r->legs,
            'is_active' => (bool) $r->is_active,
        ];
    }
}
