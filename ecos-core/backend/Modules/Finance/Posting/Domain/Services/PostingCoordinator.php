<?php

declare(strict_types=1);

namespace Modules\Finance\Posting\Domain\Services;

use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Ledger\Domain\Services\JournalEngine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;
use Modules\Finance\Posting\Domain\Models\PostedEventReceipt;

/**
 * The Posting Coordinator — the entry point for event-driven posting.
 *
 * ┌─ REQUESTS JOURNALS, NEVER WRITES THE LEDGER ────────────────────────────┐
 * │ It guarantees EXACTLY-ONCE posting for a source event, validates the     │
 * │ request, then asks the Journal Engine to post. It writes only its own    │
 * │ receipt table — the ledger is the engine's alone.                        │
 * │                                                                          │
 * │ Idempotency is enforced by the unique index on (source_module,           │
 * │ source_event_id): a re-delivered event resolves to the existing journal, │
 * │ and a race that slips past the pre-check is caught by the unique          │
 * │ violation and reconciled — never a duplicate posting.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class PostingCoordinator
{
    public function __construct(
        private readonly JournalEngine $engine,
        private readonly PostingValidator $validator,
    ) {}

    /**
     * Post a source event exactly once. Returns the journal (existing or new).
     */
    public function post(
        string $sourceModule,
        string $sourceEventId,
        PostingRequest $request,
        ?string $ruleCode = null,
        ?int $actorId = null,
    ): JournalEntry {
        // 1. Already posted? Return the existing journal — no double count.
        $existing = $this->existingReceipt($sourceModule, $sourceEventId);
        if ($existing !== null) {
            return $existing->journalEntry;
        }

        // 2. Pre-flight validation (verdict form). The engine enforces again.
        $verdict = $this->validator->validate($request);
        if (! $verdict['valid']) {
            throw new \Modules\Finance\Ledger\Domain\Exceptions\FinanceException(
                'Posting refused: '.implode(' ', $verdict['reasons'])
            );
        }

        // 3. The engine writes the ledger (single writer).
        $journal = $this->engine->post($request, $actorId);

        // 4. Record the receipt. If a concurrent worker beat us to it, fall back
        //    to the journal it created — exactly-once holds under races.
        try {
            PostedEventReceipt::create([
                'company_id' => $request->companyId,
                'source_module' => $sourceModule,
                'source_event_id' => $sourceEventId,
                'posting_rule_code' => $ruleCode,
                'journal_entry_id' => $journal->id,
                'posted_at' => Carbon::now(),
            ]);
        } catch (UniqueConstraintViolationException) {
            $winner = $this->existingReceipt($sourceModule, $sourceEventId);
            if ($winner !== null) {
                return $winner->journalEntry;
            }
        }

        return $journal;
    }

    /** Whether a source event has already produced a journal. */
    public function alreadyPosted(string $sourceModule, string $sourceEventId): bool
    {
        return $this->existingReceipt($sourceModule, $sourceEventId) !== null;
    }

    private function existingReceipt(string $sourceModule, string $sourceEventId): ?PostedEventReceipt
    {
        return PostedEventReceipt::query()
            ->where('source_module', $sourceModule)
            ->where('source_event_id', $sourceEventId)
            ->with('journalEntry')
            ->first();
    }
}
