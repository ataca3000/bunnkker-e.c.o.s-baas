<?php

declare(strict_types=1);

namespace Modules\Finance\Ledger\Domain\Enums;

/**
 * A journal entry's lifecycle.
 *
 * The financial CONTENT (the lines) is immutable from creation. These states
 * track only the controlled lifecycle the Journal Engine drives: a draft awaits
 * approval; a posted entry is in the ledger; a reversed entry has been corrected
 * by a linked reversing entry. There is deliberately no "edited" or "deleted".
 */
enum JournalStatus: string
{
    case Draft = 'draft';
    case Posted = 'posted';
    case Reversed = 'reversed';

    public function label(): string
    {
        return ucfirst($this->value);
    }

    /** A posted entry counts toward balances; a draft does not. */
    public function affectsLedger(): bool
    {
        return $this === self::Posted || $this === self::Reversed;
    }

    public function isImmutableContent(): bool
    {
        // Lines are always immutable; once posted the header is too, save for the
        // one-way reversal linkage.
        return $this !== self::Draft;
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Draft => [self::Posted],
            self::Posted => [self::Reversed],
            self::Reversed => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }
}
