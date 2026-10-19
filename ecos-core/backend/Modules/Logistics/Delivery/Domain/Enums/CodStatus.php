<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Enums;

/**
 * COD completion AT THE DOOR.
 *
 * CTO decision 3 — Distribution is the single cash authority. This records
 * that money changed hands and publishes an event; it never calculates a
 * settlement and never writes to a trip's cash balance.
 */
enum CodStatus: string
{
    case NotApplicable = 'not_applicable';
    case Due = 'due';
    case Collected = 'collected';
    case Verified = 'verified';
    case Disputed = 'disputed';
    case WrittenOff = 'written_off';

    public function label(): string
    {
        return match ($this) {
            self::NotApplicable => 'Not Applicable',
            self::Due => 'Due',
            self::Collected => 'Collected',
            self::Verified => 'Verified',
            self::Disputed => 'Disputed',
            self::WrittenOff => 'Written Off',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Due => [self::Collected, self::Disputed, self::WrittenOff],
            self::Collected => [self::Verified, self::Disputed],
            self::Disputed => [self::Verified, self::WrittenOff],
            self::NotApplicable, self::Verified, self::WrittenOff => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /** BR-22: a disputed COD blocks delivery closure. */
    public function blocksClosure(): bool
    {
        return $this === self::Disputed;
    }

    /** BR-8: success is forbidden while money is still outstanding. */
    public function isOutstanding(): bool
    {
        return $this === self::Due;
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
