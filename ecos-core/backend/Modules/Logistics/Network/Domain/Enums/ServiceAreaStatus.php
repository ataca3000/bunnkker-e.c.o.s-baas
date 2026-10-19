<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Enums;

/** Commercial availability of a service area. */
enum ServiceAreaStatus: string
{
    case Draft = 'draft';
    case Active = 'active';
    case Paused = 'paused';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Active => 'Active',
            self::Paused => 'Paused',
            self::Closed => 'Closed',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Draft => [self::Active, self::Closed],
            self::Active => [self::Paused, self::Closed],
            self::Paused => [self::Active, self::Closed],
            self::Closed => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /** Only an active area accepts new capacity commitments. */
    public function acceptsCommitments(): bool
    {
        return $this === self::Active;
    }

    /**
     * Paused still SERVES existing commitments — it only stops new ones. That
     * distinction is why pause exists at all rather than just closing.
     */
    public function isServing(): bool
    {
        return in_array($this, [self::Active, self::Paused], true);
    }

    public function tone(): string
    {
        return match ($this) {
            self::Active => 'success',
            self::Paused => 'warning',
            self::Draft => 'info',
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
