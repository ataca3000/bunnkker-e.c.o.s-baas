<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\Services;

use Modules\Finance\Posting\Domain\Models\PostingRule;

/**
 * The Posting Rule Resolver — picks the ONE rule that shapes a given event's
 * journal.
 *
 * Resolution order: a company-specific rule wins over a global template, so a
 * company can override the group default without touching anyone else. A null
 * result is not an error — it means the event has no financial impact (an order
 * reservation, a purchase request) and must be recorded as "skipped".
 */
final class PostingRuleResolver
{
    public function __construct(private readonly PostingRuleRegistry $registry) {}

    public function resolve(string $eventCode, ?string $companyId): ?PostingRule
    {
        $candidates = $this->registry->candidates($eventCode, $companyId);

        if ($candidates->isEmpty()) {
            return null;
        }

        // Company override beats the global template.
        return $candidates
            ->sortByDesc(fn (PostingRule $rule) => $rule->company_id !== null ? 1 : 0)
            ->first();
    }
}
