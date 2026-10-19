<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\Services;

use Modules\Finance\Integration\Domain\Models\PostingAuditEntry;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Posting\Domain\Models\PostedEventReceipt;

/**
 * End-to-end traceability — the drill-down the auditor asks for.
 *
 *   Business Transaction → Financial Posting → Journal → Journal Lines
 *      → General Ledger accounts → (Trial Balance)
 *
 * A pure read model over the audit, receipt, journal and ledger tables. Given a
 * source entity or a journal, it reconstructs the complete chain both ways: from
 * the operational fact to the ledger, and from a ledger line back to the event
 * that caused it.
 */
final class PostingTraceService
{
    /**
     * Trace forward from an operational entity to every journal it produced.
     *
     * @return array<string, mixed>
     */
    public function forEntity(string $companyId, string $entityType, string $entityId): array
    {
        $audits = PostingAuditEntry::query()
            ->where('company_id', $companyId)
            ->where('source_entity_type', $entityType)
            ->where('source_entity_id', $entityId)
            ->orderBy('id')
            ->get();

        return [
            'source' => ['entity_type' => $entityType, 'entity_id' => $entityId],
            'postings' => $audits->map(fn (PostingAuditEntry $a) => $this->auditNode($a))->all(),
        ];
    }

    /**
     * Trace an entire chain from a journal: back to the event that caused it and
     * down to its ledger lines.
     *
     * @return array<string, mixed>
     */
    public function forJournal(string $companyId, string $journalUuid): array
    {
        $journal = JournalEntry::query()
            ->where('company_id', $companyId)
            ->where('uuid', $journalUuid)
            ->with('lines')
            ->firstOrFail();

        $receipt = PostedEventReceipt::query()->where('journal_entry_id', $journal->id)->first();
        $audit = PostingAuditEntry::query()->where('journal_entry_id', $journal->id)->orderBy('id')->first();

        return [
            'business_transaction' => $audit !== null ? [
                'module' => $audit->source_module,
                'entity_type' => $audit->source_entity_type,
                'entity_id' => $audit->source_entity_id,
                'event_code' => $audit->event_code,
                'occurred_at' => $audit->occurred_at?->toIso8601String(),
                'actor_id' => $audit->actor_id,
            ] : null,
            'financial_posting' => [
                'posting_rule_code' => $receipt->posting_rule_code ?? $audit?->posting_rule_code,
                'source_module' => $receipt->source_module ?? null,
                'source_event_id' => $receipt->source_event_id ?? null,
                'posted_at' => $receipt?->posted_at?->toIso8601String(),
            ],
            'journal' => $this->journalNode($journal),
        ];
    }

    /** @return array<string, mixed> */
    private function auditNode(PostingAuditEntry $a): array
    {
        return [
            'audit_uuid' => $a->uuid,
            'event_code' => $a->event_code,
            'result' => $a->result->value,
            'posting_rule_code' => $a->posting_rule_code,
            'error' => $a->error,
            'occurred_at' => $a->occurred_at?->toIso8601String(),
            'journal' => $a->journal_entry_id !== null && $a->journalEntry !== null
                ? $this->journalNode($a->journalEntry->load('lines'))
                : null,
        ];
    }

    /** @return array<string, mixed> */
    private function journalNode(JournalEntry $journal): array
    {
        $accounts = Account::query()
            ->whereIn('id', $journal->lines->pluck('account_id')->all())
            ->get()->keyBy('id');

        return [
            'id' => $journal->uuid,
            'status' => $journal->status->value,
            'entry_date' => $journal->entry_date?->toDateString(),
            'journal_type' => $journal->journal_type?->value,
            'source' => $journal->source,
            'lines' => $journal->lines->map(function ($l) use ($accounts): array {
                $account = $accounts->get($l->account_id);

                return [
                    'account_id' => $account?->uuid,
                    'account_code' => $account?->code,
                    'account_name' => $account?->name,
                    'debit' => (float) $l->debit,
                    'credit' => (float) $l->credit,
                ];
            })->all(),
            'total_debit' => (float) $journal->totalDebit(),
            'total_credit' => (float) $journal->totalCredit(),
        ];
    }
}
