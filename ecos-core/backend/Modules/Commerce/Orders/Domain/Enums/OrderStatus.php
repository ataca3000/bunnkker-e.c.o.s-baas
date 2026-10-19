<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Enums;

/**
 * V3 Order Status Lifecycle (TASK-ORDERS-LIFECYCLE-ARCH-002).
 *
 * Primary flow:  New → In Progress → Ready for Dispatch → Out for Delivery → Delivered
 * Exception:     Awaiting Payment / Awaiting Stock / Scheduled / On Hold
 * Terminal:      Delivered / Cancelled / Returned
 */
enum OrderStatus: string
{
    // ── Primary Flow ──────────────────────────────────────────────────────
    case NewOrder          = 'new';
    case InProgress        = 'in_progress';
    case ReadyForDispatch  = 'ready_for_dispatch';
    case OutForDelivery    = 'out_for_delivery';
    case Delivered         = 'delivered';

    // ── Exception States ──────────────────────────────────────────────────
    case AwaitingPayment   = 'awaiting_payment';
    case AwaitingStock     = 'awaiting_stock';
    case Scheduled         = 'scheduled';
    case OnHold            = 'on_hold';

    // ── Terminal ──────────────────────────────────────────────────────────
    case Cancelled         = 'cancelled';
    case Returned          = 'returned';

    public function label(): string
    {
        return match ($this) {
            self::NewOrder         => 'New',
            self::InProgress       => 'In Progress',
            self::ReadyForDispatch => 'Ready for Dispatch',
            self::OutForDelivery   => 'Out for Delivery',
            self::Delivered        => 'Delivered',
            self::AwaitingPayment  => 'Awaiting Payment',
            self::AwaitingStock    => 'Awaiting Stock',
            self::Scheduled        => 'Scheduled',
            self::OnHold           => 'On Hold',
            self::Cancelled        => 'Cancelled',
            self::Returned         => 'Returned',
        };
    }

    /**
     * Terminal: order has reached its final business state.
     * Delivered = fulfilled; Cancelled = explicitly ended; Returned = return processed.
     */
    public function isTerminal(): bool
    {
        return in_array($this, [self::Delivered, self::Cancelled, self::Returned], true);
    }

    /**
     * Structural lock: product/price/shipping data is immutable from InProgress onward.
     * To unlock, return the order to New or AwaitingPayment.
     */
    public function isLocked(): bool
    {
        return ! in_array($this, [self::NewOrder, self::Scheduled, self::AwaitingPayment], true);
    }

    /** Returns true if the order is pre-activation (future-dated). */
    public function isPreActivation(): bool
    {
        return $this === self::Scheduled;
    }

    /**
     * Official V3 display order across all dashboards, filters, and analytics.
     */
    public static function displayOrder(): array
    {
        return [
            self::NewOrder,
            self::Scheduled,
            self::AwaitingPayment,
            self::InProgress,
            self::AwaitingStock,
            self::ReadyForDispatch,
            self::OutForDelivery,
            self::Delivered,
            self::Returned,
            self::OnHold,
            self::Cancelled,
        ];
    }
}
