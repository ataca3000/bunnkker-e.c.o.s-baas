<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\Services;

use Modules\Finance\Integration\Domain\Enums\PostingResult;
use Modules\Finance\Integration\Domain\ValueObjects\FinancialEvent;
use Modules\Finance\Integration\Domain\ValueObjects\PostingOutcome;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Posting\Domain\Models\PostedEventReceipt;
use Modules\Finance\Posting\Domain\Services\PostingCoordinator;
use Throwable;

/**
 * The Financial Event Processor — the heart of the integration layer.
 *
 * ┌─ EVENT → RULE → JOURNAL → LEDGER, EXACTLY ONCE ─────────────────────────┐
 * │ It resolves the posting rule for a business event, shapes a balanced      │
 * │ request from it, and asks the Posting Engine to post — which is itself     │
 * │ idempotent. It NEVER writes the ledger. Every outcome is audited: posted,  │
 * │ duplicate (already posted), skipped (no financial impact), or failed       │
 * │ (dead-lettered for replay). A failure here never throws into the caller's  │
 * │ operational transaction — Finance degrades safely, never corrupts.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class FinancialEventProcessor
{
    public function __construct(
        private readonly PostingRuleResolver $resolver,
        private readonly RulePostingStrategy $strategy,
        private readonly PostingCoordinator $coordinator,
        private readonly PostingAuditRecorder $audit,
        private readonly DeadLetterService $deadLetters,
    ) {}

    public function process(FinancialEvent $event): PostingOutcome
    {
        $rule = $this->resolver->resolve($event->eventCode(), $event->companyId);

        // No rule = no financial impact (a reservation, a purchase request). We
        // record that the event was seen and correctly did nothing.
        if ($rule === null) {
            $entry = $this->audit->record($event, PostingResult::Skipped);

            return new PostingOutcome(PostingResult::Skipped, auditUuid: $entry->uuid);
        }

        // Already posted? Return the existing journal — never double count.
        $existingJournalId = $this->existingJournalId($event);
        if ($existingJournalId !== null) {
            $entry = $this->audit->record($event, PostingResult::Duplicate, $existingJournalId, (string) $rule->code);

            return new PostingOutcome(PostingResult::Duplicate, $existingJournalId, $entry->uuid, ruleCode: (string) $rule->code);
        }

        try {
            $request = $this->strategy->buildFromRule($rule, $event);
            $journal = $this->coordinator->post(
                $event->sourceModule,
                $event->idempotencyKey,
                $request,
                (string) $rule->code,
                $event->actorId,
            );

            $entry = $this->audit->record($event, PostingResult::Posted, (int) $journal->id, (string) $rule->code);

            return new PostingOutcome(PostingResult::Posted, (int) $journal->id, $entry->uuid, ruleCode: (string) $rule->code);
        } catch (Throwable $e) {
            $letter = $this->deadLetters->record($event, $e->getMessage());
            $entry = $this->audit->record($event, PostingResult::Failed, null, (string) $rule->code, $e->getMessage());

            return new PostingOutcome(
                PostingResult::Failed,
                auditUuid: $entry->uuid,
                deadLetterUuid: $letter->uuid,
                ruleCode: (string) $rule->code,
                error: $e->getMessage(),
            );
        }
    }

    /**
     * Post a batch of events. Each is processed independently — one failure
     * dead-letters that event without stopping the rest.
     *
     * @param  iterable<FinancialEvent>  $events
     * @return list<PostingOutcome>
     */
    public function processBatch(iterable $events): array
    {
        $outcomes = [];
        foreach ($events as $event) {
            $outcomes[] = $this->process($event);
        }

        return $outcomes;
    }

    /**
     * Preview the journal a business event would produce, WITHOUT posting it.
     *
     * @return array<string, mixed>
     */
    public function preview(FinancialEvent $event): array
    {
        $rule = $this->resolver->resolve($event->eventCode(), $event->companyId);

        if ($rule === null) {
            return ['result' => PostingResult::Skipped->value, 'reason' => 'No posting rule — this event has no financial impact.'];
        }

        try {
            $request = $this->strategy->buildFromRule($rule, $event);
        } catch (Throwable $e) {
            return ['result' => 'error', 'rule_code' => (string) $rule->code, 'error' => $e->getMessage()];
        }

        $accounts = Account::query()
            ->whereIn('id', array_map(static fn ($l) => $l->accountId, $request->lines))
            ->get()->keyBy('id');

        $lines = array_map(static function ($l) use ($accounts): array {
            $account = $accounts->get($l->accountId);

            return [
                'account_id' => $account?->uuid,
                'account_code' => $account?->code,
                'account_name' => $account?->name,
                'debit' => round($l->debit, 4),
                'credit' => round($l->credit, 4),
            ];
        }, $request->lines);

        return [
            'result' => PostingResult::Previewed->value,
            'rule_code' => (string) $rule->code,
            'entry_date' => $request->entryDate->toDateString(),
            'lines' => $lines,
            'total_debit' => $request->totalDebit(),
            'total_credit' => $request->totalCredit(),
            'balanced' => $request->isBalanced(),
        ];
    }

    private function existingJournalId(FinancialEvent $event): ?int
    {
        $receipt = PostedEventReceipt::query()
            ->where('source_module', $event->sourceModule)
            ->where('source_event_id', $event->idempotencyKey)
            ->first();

        return $receipt !== null ? (int) $receipt->journal_entry_id : null;
    }
}
