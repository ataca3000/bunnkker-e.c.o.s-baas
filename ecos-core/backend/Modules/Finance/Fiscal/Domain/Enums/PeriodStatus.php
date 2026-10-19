<?php

declare(strict_types=1);

namespace Modules\Finance\Fiscal\Domain\Enums;

/**
 * A fiscal period's lifecycle — the posting gate.
 *
 *   future → open → closed → locked
 *
 * Only `open` accepts postings. `closed` is read-only but can be reopened by an
 * authorised controller. `locked` is permanent — a statutory line in the sand.
 */
enum PeriodStatus: string
{
    case Future = 'future';
    case Open = 'open';
    case Closed = 'closed';
    case Locked = 'locked';

    public function label(): string
    {
        return ucfirst($this->value);
    }

    /** The single most important predicate in the platform: may a journal enter? */
    public function acceptsPostings(): bool
    {
        return $this === self::Open;
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Future => [self::Open],
            self::Open => [self::Closed],
            // A closed period may be reopened for late adjustments; a locked one never.
            self::Closed => [self::Open, self::Locked],
            self::Locked => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }
}
