<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Enums;

/**
 * A trip's position in the dispatch queue.
 *
 * `deferred` is distinct from `blocked`: deferred is a dispatcher's deliberate
 * "later", blocked is the system saying it cannot proceed. Collapsing them
 * would hide which trips need a decision and which need a fix.
 */
enum QueueItemStatus: string
{
    case Waiting = 'waiting';
    case Claimed = 'claimed';
    case Assigned = 'assigned';
    case Blocked = 'blocked';
    case Deferred = 'deferred';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Waiting => 'Waiting',
            self::Claimed => 'Claimed',
            self::Assigned => 'Assigned',
            self::Blocked => 'Blocked',
            self::Deferred => 'Deferred',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Waiting => [self::Claimed, self::Blocked, self::Deferred, self::Cancelled],
            self::Claimed => [self::Assigned, self::Blocked, self::Waiting, self::Deferred],
            self::Assigned => [self::Completed, self::Waiting],
            self::Blocked => [self::Waiting, self::Deferred, self::Cancelled],
            self::Deferred => [self::Waiting, self::Cancelled],
            self::Completed, self::Cancelled => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Completed, self::Cancelled], true);
    }

    /** Items a dispatcher still has to act on. */
    public function needsAction(): bool
    {
        return in_array($this, [self::Waiting, self::Blocked], true);
    }

    /** Whether this item still occupies a live slot in the queue. */
    public function isLive(): bool
    {
        return ! $this->isTerminal();
    }

    public function tone(): string
    {
        return match ($this) {
            self::Assigned, self::Completed => 'success',
            self::Blocked => 'danger',
            self::Deferred => 'warning',
            self::Claimed => 'info',
            self::Waiting => 'neutral',
            self::Cancelled => 'neutral',
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
