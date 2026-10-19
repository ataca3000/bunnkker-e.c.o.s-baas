<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Enums;

/**
 * An exception's lifecycle.
 *
 * AutoResolved is distinct from Resolved on purpose: "the condition cleared on
 * its own" and "a person dealt with it" are different facts, and collapsing
 * them would make the resolution statistics lie about how much work was done.
 */
enum ExceptionStatus: string
{
    case Open = 'open';
    case Acknowledged = 'acknowledged';
    case Escalated = 'escalated';
    case Resolved = 'resolved';
    case Suppressed = 'suppressed';
    case AutoResolved = 'auto_resolved';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Open',
            self::Acknowledged => 'Acknowledged',
            self::Escalated => 'Escalated',
            self::Resolved => 'Resolved',
            self::Suppressed => 'Suppressed',
            self::AutoResolved => 'Cleared on its own',
        };
    }

    public function tone(): string
    {
        return match ($this) {
            self::Open => 'danger',
            self::Escalated => 'danger',
            self::Acknowledged => 'warning',
            self::Resolved, self::AutoResolved => 'success',
            self::Suppressed => 'neutral',
        };
    }

    /** Still in somebody's queue. */
    public function isOutstanding(): bool
    {
        return match ($this) {
            self::Open, self::Acknowledged, self::Escalated => true,
            self::Resolved, self::Suppressed, self::AutoResolved => false,
        };
    }

    /** Nobody has looked at it yet — the number that matters on a dashboard. */
    public function needsAttention(): bool
    {
        return $this === self::Open || $this === self::Escalated;
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Open => [self::Acknowledged, self::Escalated, self::Resolved, self::Suppressed, self::AutoResolved],
            self::Acknowledged => [self::Escalated, self::Resolved, self::AutoResolved],
            self::Escalated => [self::Acknowledged, self::Resolved, self::AutoResolved],
            // A suppressed exception can still clear on its own, and should be
            // recorded as having done so rather than lingering for ever.
            self::Suppressed => [self::Open, self::AutoResolved],
            self::Resolved, self::AutoResolved => [],
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

    /** @return list<array{value: string, label: string, tone: string}> */
    public static function options(): array
    {
        return array_map(
            static fn (self $c) => ['value' => $c->value, 'label' => $c->label(), 'tone' => $c->tone()],
            self::cases(),
        );
    }
}
