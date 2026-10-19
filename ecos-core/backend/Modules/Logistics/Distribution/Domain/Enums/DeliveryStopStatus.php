<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Enums;

enum DeliveryStopStatus: string
{
    case Pending = 'pending';
    case InProgress = 'in_progress';
    case Delivered = 'delivered';
    case Partial = 'partial';
    case Failed = 'failed';
    case Returned = 'returned';
    case Skipped = 'skipped';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::InProgress => 'In Progress',
            self::Delivered => 'Delivered',
            self::Partial => 'Partially Delivered',
            self::Failed => 'Failed',
            self::Returned => 'Returned',
            self::Skipped => 'Skipped',
        };
    }

    /** A stop that has reached an outcome and no longer counts as outstanding. */
    public function isSettled(): bool
    {
        return in_array($this, [
            self::Delivered, self::Partial, self::Failed, self::Returned, self::Skipped,
        ], true);
    }

    /** Only these outcomes may carry a payment collection. */
    public function acceptsPayment(): bool
    {
        return in_array($this, [self::Delivered, self::Partial], true);
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
