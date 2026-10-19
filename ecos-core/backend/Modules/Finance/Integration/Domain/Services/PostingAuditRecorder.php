<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\Services;

use Modules\Finance\Integration\Domain\Enums\PostingResult;
use Modules\Finance\Integration\Domain\Models\PostingAuditEntry;
use Modules\Finance\Integration\Domain\ValueObjects\FinancialEvent;

/**
 * Writes the append-only posting audit — one row per processing attempt, success
 * or not. Every posting the platform makes is traceable back to the event, the
 * rule, the actor and the moment through these rows.
 */
final class PostingAuditRecorder
{
    public function record(
        FinancialEvent $event,
        PostingResult $result,
        ?int $journalEntryId = null,
        ?string $ruleCode = null,
        ?string $error = null,
    ): PostingAuditEntry {
        return PostingAuditEntry::create([
            'company_id' => $event->companyId,
            'source_module' => $event->sourceModule,
            'source_entity_type' => $event->entityType,
            'source_entity_id' => $event->entityId,
            'event_code' => $event->eventCode(),
            'source_event_id' => $event->idempotencyKey,
            'posting_rule_code' => $ruleCode,
            'journal_entry_id' => $journalEntryId,
            'result' => $result->value,
            'error' => $error,
            'actor_id' => $event->actorId,
            'occurred_at' => $event->occurredAt,
            'payload' => $event->toArray(),
        ]);
    }
}
