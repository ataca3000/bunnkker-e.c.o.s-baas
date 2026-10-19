<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Domain\Enums;

/** The lifecycle of an employment contract. */
enum ContractStatus: string
{
    case Draft = 'draft';
    case Active = 'active';
    case Expired = 'expired';
    case Terminated = 'terminated';

    public function isOpen(): bool
    {
        return in_array($this, [self::Draft, self::Active], true);
    }

    /** @return array<int, self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Draft => [self::Active, self::Terminated],
            self::Active => [self::Expired, self::Terminated],
            self::Expired, self::Terminated => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
