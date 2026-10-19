<?php

declare(strict_types=1);

namespace Modules\Finance\Fiscal\Domain\Enums;

/**
 * A fiscal year's lifecycle. A year cannot lock while any of its periods is
 * still open, and no period inside a locked year may accept postings.
 */
enum FiscalYearStatus: string
{
    case Open = 'open';
    case Closed = 'closed';
    case Locked = 'locked';

    public function label(): string
    {
        return ucfirst($this->value);
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Open => [self::Closed],
            self::Closed => [self::Open, self::Locked],
            self::Locked => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }
}
