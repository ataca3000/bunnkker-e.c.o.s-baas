<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Enums;

enum PodStatus: string
{
    case Pending = 'pending';
    case Captured = 'captured';
    case Validated = 'validated';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Captured => 'Captured',
            self::Validated => 'Validated',
            self::Rejected => 'Rejected',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::Captured],
            self::Captured => [self::Validated, self::Rejected],
            // A rejected POD is recaptured rather than silently accepted.
            self::Rejected => [self::Captured],
            self::Validated => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isValidated(): bool
    {
        return $this === self::Validated;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(static fn (self $c) => ['value' => $c->value, 'label' => $c->label()], self::cases());
    }
}
