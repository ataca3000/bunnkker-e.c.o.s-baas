<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Enums;

/**
 * `partially_released` is a FIRST-CLASS state, not an error.
 *
 * On any real morning a handful of trips are blocked while the rest must go
 * out. Modelling that as failure would force dispatchers to work around the
 * system, which is how a dispatch tool stops being used.
 */
enum DispatchBoardStatus: string
{
    case Open = 'open';
    case Planning = 'planning';
    case Proposed = 'proposed';
    case Releasing = 'releasing';
    case PartiallyReleased = 'partially_released';
    case Released = 'released';
    case Closed = 'closed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Open',
            self::Planning => 'Planning',
            self::Proposed => 'Proposed',
            self::Releasing => 'Releasing',
            self::PartiallyReleased => 'Partially Released',
            self::Released => 'Released',
            self::Closed => 'Closed',
            self::Cancelled => 'Cancelled',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Open => [self::Planning, self::Cancelled],
            self::Planning => [self::Proposed, self::Open, self::Cancelled],
            self::Proposed => [self::Releasing, self::Planning, self::Cancelled],
            self::Releasing => [self::Released, self::PartiallyReleased, self::Proposed],
            self::PartiallyReleased => [self::Releasing, self::Released, self::Closed],
            self::Released => [self::Closed],
            self::Closed, self::Cancelled => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Closed, self::Cancelled], true);
    }

    public function isOpen(): bool
    {
        return ! $this->isTerminal();
    }

    public function tone(): string
    {
        return match ($this) {
            self::Released => 'success',
            self::PartiallyReleased, self::Releasing => 'warning',
            self::Cancelled => 'danger',
            self::Closed => 'neutral',
            default => 'info',
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
