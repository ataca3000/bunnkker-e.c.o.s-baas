<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Ledger\Domain\Services\JournalEngine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingLine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;

/**
 * Manual journals, under maker/checker segregation of duties.
 *
 * A maker (finance.journal.create) submits a balanced draft; a DIFFERENT person
 * (finance.journal.post) approves and posts it. The engine enforces that the
 * two are never the same, on top of the distinct permissions.
 */
class JournalController extends Controller
{
    public function __construct(private readonly JournalEngine $engine) {}

    public function index(Request $request): JsonResponse
    {
        $entries = JournalEntry::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->with('lines')
            ->latest('id')
            ->limit(100)
            ->get()
            ->map(fn (JournalEntry $e) => $this->payload($e));

        return response()->json(['data' => $entries]);
    }

    public function show(Request $request, string $uuid): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->entry($request, $uuid))]);
    }

    /** Maker: submit a balanced draft. */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'entry_date' => ['required', 'date'],
            'reference' => ['nullable', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
            'lines' => ['required', 'array', 'min:2'],
            'lines.*.account_id' => ['required', 'string'],   // account uuid
            'lines.*.side' => ['required', Rule::in(['debit', 'credit'])],
            'lines.*.amount' => ['required', 'numeric', 'gt:0'],
            'lines.*.cost_center_id' => ['nullable', 'integer'],
            'lines.*.branch_id' => ['nullable', 'string'],
            'lines.*.description' => ['nullable', 'string', 'max:500'],
        ]);

        $companyId = $this->companyId($request);
        $request0 = $this->buildRequest($companyId, $validated);

        $entry = $this->engine->submitDraft($request0, (int) $request->user()->id);

        return response()->json(['data' => $this->payload($entry->load('lines'))], 201);
    }

    /** Checker: approve and post a draft (must differ from the maker). */
    public function approve(Request $request, string $uuid): JsonResponse
    {
        $entry = $this->entry($request, $uuid);
        $posted = $this->engine->approveAndPost($entry, (int) $request->user()->id);

        return response()->json(['data' => $this->payload($posted->load('lines'))]);
    }

    /** Correct a posted entry with a reversing entry. */
    public function reverse(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'max:500']]);
        $entry = $this->entry($request, $uuid);

        $reversal = $this->engine->reverse($entry, $validated['reason'], (int) $request->user()->id);

        return response()->json(['data' => $this->payload($reversal->load('lines'))], 201);
    }

    /** Discard a pre-ledger draft. */
    public function discard(Request $request, string $uuid): JsonResponse
    {
        $this->engine->discardDraft($this->entry($request, $uuid));

        return response()->json(['message' => 'Draft discarded.']);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @param array<string, mixed> $validated */
    private function buildRequest(string $companyId, array $validated): PostingRequest
    {
        $accountsByUuid = Account::query()
            ->where('company_id', $companyId)
            ->whereIn('uuid', array_column($validated['lines'], 'account_id'))
            ->get()
            ->keyBy('uuid');

        $lines = array_map(function (array $line) use ($companyId, $accountsByUuid): PostingLine {
            $account = $accountsByUuid->get($line['account_id']);
            abort_if($account === null, 422, "Account {$line['account_id']} does not exist.");

            $dimensions = [
                'costCenterId' => $line['cost_center_id'] ?? null,
                'branchId' => $line['branch_id'] ?? null,
                'description' => $line['description'] ?? null,
            ];

            return $line['side'] === 'debit'
                ? PostingLine::debit((int) $account->id, (float) $line['amount'], $companyId, $dimensions)
                : PostingLine::credit((int) $account->id, (float) $line['amount'], $companyId, $dimensions);
        }, $validated['lines']);

        return new PostingRequest(
            companyId: $companyId,
            entryDate: Carbon::parse($validated['entry_date']),
            lines: $lines,
            reference: $validated['reference'] ?? null,
            description: $validated['description'] ?? null,
            source: 'manual',
        );
    }

    private function entry(Request $request, string $uuid): JournalEntry
    {
        return JournalEntry::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(JournalEntry $e): array
    {
        return [
            'id' => $e->uuid,
            'reference' => $e->reference,
            'description' => $e->description,
            'entry_date' => $e->entry_date?->toDateString(),
            'status' => $e->status->value,
            'source' => $e->source,
            'total_debit' => $e->relationLoaded('lines') ? (float) $e->totalDebit() : null,
            'total_credit' => $e->relationLoaded('lines') ? (float) $e->totalCredit() : null,
            'reverses_journal_id' => $e->reverses_journal_id,
            'reversed_by_journal_id' => $e->reversed_by_journal_id,
            'created_by' => $e->created_by,
            'approved_by' => $e->approved_by,
            'posted_by' => $e->posted_by,
            'posted_at' => $e->posted_at?->toIso8601String(),
            'lines' => $e->relationLoaded('lines') ? $e->lines->map(fn ($l) => [
                'account_id' => $l->account_id,
                'debit' => (float) $l->debit,
                'credit' => (float) $l->credit,
                'cost_center_id' => $l->cost_center_id,
                'description' => $l->description,
            ])->all() : [],
        ];
    }

    private function companyId(Request $request): string
    {
        return (string) $request->user()->company_id;
    }
}
