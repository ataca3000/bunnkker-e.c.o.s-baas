<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\Services;

use Illuminate\Support\Collection;
use Modules\Finance\Integration\Domain\Enums\BusinessEventType;
use Modules\Finance\Posting\Domain\Models\PostingRule;

/**
 * The Posting Rule Registry — the catalogue of configured posting rules.
 *
 * Rules live in finance_posting_rules (a rule is CONFIGURATION, never code): a
 * global template (company_id null) or a company override. The registry is the
 * read surface over that table and the authority on which business events are
 * financially recognised at all.
 */
final class PostingRuleRegistry
{
    /** Every active rule that could apply to an event code (company + global). */
    public function candidates(string $eventCode, ?string $companyId): Collection
    {
        return PostingRule::query()
            ->where('code', $eventCode)
            ->where('is_active', true)
            ->when($companyId !== null, fn ($q) => $q->where(function ($w) use ($companyId): void {
                $w->where('company_id', $companyId)->orWhereNull('company_id');
            }), fn ($q) => $q->whereNull('company_id'))
            ->get();
    }

    /** All active rules, newest first — the configuration surface for the UI. */
    public function all(?string $companyId = null): Collection
    {
        return PostingRule::query()
            ->when($companyId !== null, fn ($q) => $q->where(function ($w) use ($companyId): void {
                $w->where('company_id', $companyId)->orWhereNull('company_id');
            }))
            ->orderBy('code')
            ->get();
    }

    /** Whether a business event is one Finance knows how to react to. */
    public function isRecognisedEvent(string $eventCode): bool
    {
        return BusinessEventType::tryFromValue($eventCode) !== null;
    }
}
