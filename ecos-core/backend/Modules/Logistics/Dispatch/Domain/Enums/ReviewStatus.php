<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Enums;

/**
 * Assignment review.
 *
 * Requesting and deciding are separate permissions — the same
 * separation-of-duties principle LOG-005 applied to POD capture vs. validation:
 * a decision that carries risk should not be self-certified.
 */
enum ReviewStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Withdrawn = 'withdrawn';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending review',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
            self::Withdrawn => 'Withdrawn',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::Approved, self::Rejected, self::Withdrawn],
            self::Approved, self::Rejected, self::Withdrawn => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isDecided(): bool
    {
        return $this !== self::Pending;
    }

    /** A rejection must say why; an approval need not. */
    public function requiresReason(): bool
    {
        return $this === self::Rejected;
    }

    public function tone(): string
    {
        return match ($this) {
            self::Approved => 'success',
            self::Rejected => 'danger',
            self::Pending => 'warning',
            self::Withdrawn => 'neutral',
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
