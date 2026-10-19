<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Enums;

/**
 * Lifecycle of one order's journey to the customer, spanning every attempt.
 *
 * A Delivery outlives any single trip: Distribution's DeliveryStop dies with
 * its trip, which is exactly why retry lives here and not there.
 */
enum DeliveryStatus: string
{
    case Pending = 'pending';
    case Scheduled = 'scheduled';
    case InTransit = 'in_transit';
    case OutForDelivery = 'out_for_delivery';
    case Attempted = 'attempted';
    case Delivered = 'delivered';
    case PartiallyDelivered = 'partially_delivered';
    case Failed = 'failed';
    case AwaitingRetry = 'awaiting_retry';
    case Returning = 'returning';
    case Returned = 'returned';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Scheduled => 'Scheduled',
            self::InTransit => 'In Transit',
            self::OutForDelivery => 'Out for Delivery',
            self::Attempted => 'Attempted',
            self::Delivered => 'Delivered',
            self::PartiallyDelivered => 'Partially Delivered',
            self::Failed => 'Failed',
            self::AwaitingRetry => 'Awaiting Retry',
            self::Returning => 'Returning',
            self::Returned => 'Returned',
            self::Cancelled => 'Cancelled',
        };
    }

    /**
     * Semantic tone for the UI badge — success / warning / danger / neutral /
     * info. Kept next to the state machine so a new case cannot ship without
     * one.
     */
    public function tone(): string
    {
        return match ($this) {
            self::Delivered => 'success',
            self::PartiallyDelivered, self::Attempted, self::AwaitingRetry => 'warning',
            self::Failed => 'danger',
            self::Returning, self::Returned, self::Cancelled => 'neutral',
            self::Pending, self::Scheduled, self::InTransit, self::OutForDelivery => 'info',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::Scheduled, self::Cancelled],
            self::Scheduled => [self::InTransit, self::Pending, self::Cancelled],
            self::InTransit => [self::OutForDelivery, self::Cancelled],
            self::OutForDelivery => [self::Attempted, self::Cancelled],
            self::Attempted => [
                self::Delivered, self::PartiallyDelivered, self::Failed, self::Cancelled,
            ],
            self::Failed => [self::AwaitingRetry, self::Returning, self::Cancelled],
            self::AwaitingRetry => [self::Scheduled, self::Returning, self::Cancelled],
            self::PartiallyDelivered => [self::Returning, self::Delivered],
            self::Returning => [self::Returned],
            self::Delivered, self::Returned, self::Cancelled => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function isTerminal(): bool
    {
        return in_array($this, [self::Delivered, self::Returned, self::Cancelled], true);
    }

    /** A new attempt may only be opened from these states. */
    public function acceptsNewAttempt(): bool
    {
        return in_array($this, [self::Scheduled, self::OutForDelivery, self::InTransit], true);
    }

    public function isOpen(): bool
    {
        return ! $this->isTerminal();
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
