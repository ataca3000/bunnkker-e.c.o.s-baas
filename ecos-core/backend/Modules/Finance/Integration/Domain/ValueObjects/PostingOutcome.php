<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\ValueObjects;

use Modules\Finance\Integration\Domain\Enums\PostingResult;

/**
 * The result of processing one financial event: what happened, the journal it
 * produced (if any), the audit row that recorded it, and — when it failed — the
 * dead-letter it landed in and why. A complete, self-describing receipt the
 * caller can act on without re-querying.
 */
final class PostingOutcome
{
    public function __construct(
        public readonly PostingResult $result,
        public readonly ?int $journalEntryId = null,
        public readonly ?string $auditUuid = null,
        public readonly ?string $deadLetterUuid = null,
        public readonly ?string $ruleCode = null,
        public readonly ?string $error = null,
    ) {}

    public function isSuccessful(): bool
    {
        return $this->result->isSuccessful();
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'result' => $this->result->value,
            'journal_entry_id' => $this->journalEntryId,
            'audit_uuid' => $this->auditUuid,
            'dead_letter_uuid' => $this->deadLetterUuid,
            'rule_code' => $this->ruleCode,
            'error' => $this->error,
        ];
    }
}
