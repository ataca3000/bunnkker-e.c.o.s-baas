<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\Services;

use Modules\Finance\Integration\Domain\Enums\BusinessEventType;
use Modules\Finance\Integration\Domain\ValueObjects\FinancialEvent;
use Modules\Finance\Ledger\Domain\Enums\JournalType;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingLine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;
use Modules\Finance\Posting\Domain\Contracts\PostingStrategyInterface;
use Modules\Finance\Posting\Domain\Models\PostingRule;

/**
 * The rule-driven posting strategy — the F3 sibling of DirectPostingStrategy.
 *
 * ┌─ CONFIGURATION → A BALANCED JOURNAL, NO HARDCODED ACCOUNTS ──────────────┐
 * │ It reads a rule's legs ({side, role, source}), resolves each role to the  │
 * │ company's account and each amount by name from the event, and returns a   │
 * │ balanced PostingRequest. It resolves accounts and amounts; it NEVER writes │
 * │ the ledger. A leg whose amount is zero (e.g. no tax) drops out, so one     │
 * │ rule serves both taxed and untaxed events without branching.              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class RulePostingStrategy implements PostingStrategyInterface
{
    /**
     * A leg naming this defers its account role to the event's inventory class.
     * The '@' prefix keeps it impossible to confuse with a real role name.
     */
    public const ROLE_BY_INVENTORY_CLASS = '@inventory_class';

    /**
     * Inventory class → account role. The classes are the publisher's vocabulary
     * (singular, product-shaped); the roles are Finance's (plural, account-shaped).
     * This table is the only place the two meet, and it is exhaustive by design —
     * a class with no entry is refused rather than defaulted.
     *
     * WIP is absent deliberately: it is a manufacturing state, not a class of
     * stock, and its account is driven by which manufacturing event occurred.
     */
    private const INVENTORY_CLASS_ROLES = [
        'raw_material' => 'raw_materials',
        'packaging_material' => 'packaging_materials',
        'finished_good' => 'finished_goods',
    ];

    public function __construct(private readonly AccountRoleResolver $roles) {}

    public function supports(string $eventType): bool
    {
        return BusinessEventType::tryFromValue($eventType) !== null;
    }

    /**
     * @param  array<string, mixed>  $context  {event: FinancialEvent, rule: PostingRule}
     */
    public function build(string $eventType, array $context): PostingRequest
    {
        return $this->buildFromRule($context['rule'], $context['event']);
    }

    /** The typed entry point the processor uses. */
    public function buildFromRule(PostingRule $rule, FinancialEvent $event): PostingRequest
    {
        $legs = $rule->legs ?? [];
        if ($legs === []) {
            throw FinanceException::postingRuleHasNoLegs((string) $rule->code);
        }

        $dimensions = [
            'branchId' => $event->branchId(),
            'costCenterId' => $event->costCenterId(),
            'currency' => $event->currency,
        ];

        $lines = [];
        foreach ($legs as $leg) {
            $amount = $event->amount((string) $leg['source']);
            if ($amount <= 0.0) {
                continue; // a zero leg (e.g. no VAT on this event) simply drops out
            }

            $accountId = $this->roles->resolve($event->companyId, $this->roleFor($leg, $event));
            $lineDims = $dimensions + ['description' => $leg['description'] ?? null];

            $lines[] = ((string) $leg['side'] === 'debit')
                ? PostingLine::debit($accountId, $amount, $event->companyId, $lineDims)
                : PostingLine::credit($accountId, $amount, $event->companyId, $lineDims);
        }

        return new PostingRequest(
            companyId: $event->companyId,
            entryDate: $event->occurredAt,
            lines: $lines,
            reference: $event->reference ?? ($event->entityType.'#'.$event->entityId),
            description: $event->description ?? $rule->description ?? $event->eventCode(),
            source: 'posting',
            sourceModule: $event->sourceModule,
            sourceEventId: $event->idempotencyKey,
            journalType: $this->journalTypeFor($event->eventType)->value,
        );
    }

    /**
     * The account role a leg posts to.
     *
     * ┌─ WHY A LEG CAN DEFER ITS ROLE ──────────────────────────────────────┐
     * │ Stock does not post to one account. Raw materials, packaging and     │
     * │ finished goods each have their own, and a goods receipt or a count   │
     * │ can involve any of them. A rule cannot name the account, because the │
     * │ rule is written once and the answer differs per movement.            │
     * │                                                                      │
     * │ So a leg may name the marker below instead, and the class the        │
     * │ publisher stated on the event chooses the role. Finance still looks  │
     * │ nothing up: the answer travelled with the event.                     │
     * └──────────────────────────────────────────────────────────────────────┘
     *
     * An event that reaches such a leg without a class is refused. There is no
     * default: guessing which inventory account to debit would misstate the
     * balance sheet in a way nothing downstream could detect.
     *
     * @param  array<string, mixed>  $leg
     */
    private function roleFor(array $leg, FinancialEvent $event): string
    {
        $role = (string) $leg['role'];

        if ($role !== self::ROLE_BY_INVENTORY_CLASS) {
            return $role;
        }

        $class = $event->inventoryClass();

        if ($class === null) {
            throw FinanceException::inventoryClassMissing($event->eventCode());
        }

        return self::INVENTORY_CLASS_ROLES[$class]
            ?? throw FinanceException::inventoryClassUnknown($class, $event->eventCode());
    }

    private function journalTypeFor(BusinessEventType $type): JournalType
    {
        return match ($type->module()) {
            'pos' => JournalType::Sales,
            'procurement' => JournalType::Purchase,
            default => JournalType::General,
        };
    }
}
