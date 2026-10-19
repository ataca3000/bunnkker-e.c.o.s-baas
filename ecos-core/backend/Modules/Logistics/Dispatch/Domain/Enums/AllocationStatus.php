<?php

declare(strict_types=1);

namespace Modules\Logistics\Dispatch\Domain\Enums;

/**
 * A resource allocation's life.
 *
 * `confirmed` means V1 committed it (Distribution holds the trip, Drivers holds
 * the pairing). Before that it is only Dispatch's intention.
 */
enum AllocationStatus: string
{
    case Proposed = 'proposed';
    case Reserved = 'reserved';
    case Confirmed = 'confirmed';
    case Released = 'released';
    case Failed = 'failed';

    public function label(): string
    {
        return match ($this) {
            self::Proposed => 'Proposed',
            self::Reserved => 'Reserved',
            self::Confirmed => 'Confirmed',
            self::Released => 'Released',
            self::Failed => 'Failed',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Proposed => [self::Reserved, self::Released, self::Failed],
            self::Reserved => [self::Confirmed, self::Released, self::Failed],
            self::Confirmed => [self::Released],
            self::Released, self::Failed => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /** States in which the resource is genuinely spoken for. */
    public function holdsResource(): bool
    {
        return in_array($this, [self::Reserved, self::Confirmed], true);
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Released, self::Failed], true);
    }

    public function tone(): string
    {
        return match ($this) {
            self::Confirmed => 'success',
            self::Reserved => 'info',
            self::Failed => 'danger',
            self::Proposed => 'neutral',
            self::Released => 'neutral',
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
