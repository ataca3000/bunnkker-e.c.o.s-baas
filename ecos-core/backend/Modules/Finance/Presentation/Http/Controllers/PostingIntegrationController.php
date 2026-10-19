<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Modules\Finance\Integration\Domain\Enums\BusinessEventType;
use Modules\Finance\Integration\Domain\Models\PostingAuditEntry;
use Modules\Finance\Integration\Domain\Services\FinancialEventProcessor;
use Modules\Finance\Integration\Domain\Services\PostingTraceService;
use Modules\Finance\Integration\Domain\ValueObjects\FinancialEvent;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * The read + preview surface over the integration layer: preview the journal an
 * event would produce, browse the posting audit, and drill down the full
 * traceability chain (business transaction → journal → ledger).
 */
class PostingIntegrationController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(
        private readonly FinancialEventProcessor $processor,
        private readonly PostingTraceService $trace,
    ) {}

    /** Preview the journal a business event would produce — nothing is posted. */
    public function preview(Request $request): JsonResponse
    {
        $event = $this->eventFromRequest($request);

        return response()->json(['data' => $this->processor->preview($event)]);
    }

    /** The posting audit — every attempt to turn an event into a journal. */
    public function audit(Request $request): JsonResponse
    {
        $entries = PostingAuditEntry::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('module'), fn ($q) => $q->where('source_module', $request->string('module')))
            ->when($request->filled('event_code'), fn ($q) => $q->where('event_code', $request->string('event_code')))
            ->when($request->filled('result'), fn ($q) => $q->where('result', $request->string('result')))
            ->latest('id')
            ->limit(200)
            ->get()
            ->map(fn (PostingAuditEntry $a) => [
                'id' => $a->uuid,
                'module' => $a->source_module,
                'entity_type' => $a->source_entity_type,
                'entity_id' => $a->source_entity_id,
                'event_code' => $a->event_code,
                'rule_code' => $a->posting_rule_code,
                'result' => $a->result->value,
                'journal_entry_id' => $a->journal_entry_id,
                'error' => $a->error,
                'occurred_at' => $a->occurred_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $entries]);
    }

    /** Trace forward from an operational entity to the journals it produced. */
    public function traceEntity(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'entity_type' => ['required', 'string', 'max:80'],
            'entity_id' => ['required', 'string', 'max:64'],
        ]);

        return response()->json(['data' => $this->trace->forEntity(
            $this->companyId($request), $validated['entity_type'], $validated['entity_id'],
        )]);
    }

    /** Trace a journal back to the event that caused it and down to its lines. */
    public function traceJournal(Request $request, string $journalUuid): JsonResponse
    {
        return response()->json(['data' => $this->trace->forJournal($this->companyId($request), $journalUuid)]);
    }

    private function eventFromRequest(Request $request): FinancialEvent
    {
        $validated = $request->validate([
            'event_type' => ['required', Rule::in(BusinessEventType::values())],
            'entity_type' => ['nullable', 'string', 'max:80'],
            'entity_id' => ['nullable', 'string', 'max:64'],
            'amounts' => ['required', 'array'],
            'amounts.*' => ['numeric'],
            'currency' => ['nullable', 'string', 'size:3'],
            'occurred_at' => ['nullable', 'date'],
            'dimensions' => ['nullable', 'array'],
            'idempotency_key' => ['nullable', 'string', 'max:80'],
        ]);

        return new FinancialEvent(
            companyId: $this->companyId($request),
            eventType: BusinessEventType::from($validated['event_type']),
            sourceModule: BusinessEventType::from($validated['event_type'])->module(),
            entityType: $validated['entity_type'] ?? null,
            entityId: $validated['entity_id'] ?? null,
            amounts: array_map(static fn ($v) => (float) $v, $validated['amounts']),
            occurredAt: isset($validated['occurred_at']) ? Carbon::parse($validated['occurred_at']) : Carbon::now(),
            idempotencyKey: $validated['idempotency_key'] ?? ('preview:'.Str::uuid()),
            dimensions: $validated['dimensions'] ?? [],
            currency: $validated['currency'] ?? 'EGP',
            actorId: $this->actorId($request),
        );
    }
}
