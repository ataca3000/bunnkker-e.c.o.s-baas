<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Enums;

/**
 * A dispatcher's working window over a board.
 *
 * `abandoned` exists separately from `closed` because a session that timed out
 * is operationally different from one a human finished — the first releases
 * locks automatically and is worth counting, the second does not.
 */
enum DispatchSessionStatus: string
{
    case Open = 'open';
    case Paused = 'paused';
    case Closing = 'closing';
    case Closed = 'closed';
    case Abandoned = 'abandoned';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Open',
            self::Paused => 'Paused',
            self::Closing => 'Closing',
            self::Closed => 'Closed',
            self::Abandoned => 'Abandoned',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Open => [self::Paused, self::Closing, self::Abandoned],
            self::Paused => [self::Open, self::Closing, self::Abandoned],
            self::Closing => [self::Closed, self::Open],
            self::Closed, self::Abandoned => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Closed, self::Abandoned], true);
    }

    /** Only an open session may claim queue items or acquire locks. */
    public function isActive(): bool
    {
        return $this === self::Open;
    }

    /** Terminal states release every lock the session still holds. */
    public function releasesLocks(): bool
    {
        return $this->isTerminal();
    }

    public function tone(): string
    {
        return match ($this) {
            self::Open => 'success',
            self::Paused, self::Closing => 'warning',
            self::Abandoned => 'danger',
            self::Closed => 'neutral',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => ['value' => $c->value, 'label' => $c->label()],
            self::cases(),
        );
    }
}
