<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Enums;

enum ConflictStatus: string
{
    case Open = 'open';
    case Acknowledged = 'acknowledged';
    case Resolved = 'resolved';
    case Overridden = 'overridden';
    case Expired = 'expired';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Open',
            self::Acknowledged => 'Acknowledged',
            self::Resolved => 'Resolved',
            self::Overridden => 'Overridden',
            self::Expired => 'No longer applies',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Open => [self::Acknowledged, self::Resolved, self::Overridden, self::Expired],
            self::Acknowledged => [self::Resolved, self::Overridden, self::Expired],
            self::Resolved, self::Overridden, self::Expired => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /** A conflict still standing in the way of a release. */
    public function isOutstanding(): bool
    {
        return in_array($this, [self::Open, self::Acknowledged], true);
    }

    /**
     * Overriding CLEARS a conflict without fixing it, so it always demands a
     * reason and is always audited. `expired` is different: the condition
     * genuinely went away on its own.
     */
    public function requiresReason(): bool
    {
        return $this === self::Overridden;
    }

    public function tone(): string
    {
        return match ($this) {
            self::Resolved => 'success',
            self::Overridden => 'warning',
            self::Open => 'danger',
            self::Acknowledged => 'info',
            self::Expired => 'neutral',
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
