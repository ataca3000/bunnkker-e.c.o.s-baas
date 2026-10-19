<?php

declare(strict_types=1);

namespace Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects;

/**
 * Order state visible to the Manufacturing Policy.
 *
 * Intentionally decoupled from Modules\Commerce\Orders — this value object
 * carries only the scalar facts the policy needs so the Manufacturing domain
 * never imports Commerce module types.
 *
 * Callers (Order integration layer, API controllers) are responsible for
 * populating these flags from the real Order entity:
 *
 *   order_status         → OrderStatus::value  (raw string)
 *   is_cancelled         → order->status === OrderStatus::Cancelled
 *   already_manufactured → ManufacturingTransaction::existsForOrderLine($order_line_id)
 */
final readonly class OrderContext
{
    public function __construct(
        /** UUID of the parent order. */
        public string $order_id,

        /**
         * UUID of the specific order line that needs manufacturing.
         * Used for the already_manufactured check — callers query
         * ManufacturingTransaction where order_line_id = this value.
         */
        public string $order_line_id,

        /**
         * Raw order status string (e.g. 'pending', 'processing', 'completed').
         * The Policy evaluates this against its internal allowed-statuses list.
         */
        public string $order_status,

        /**
         * True when the order is in a cancelled state.
         * Checked first — supersedes all other rules.
         */
        public bool $is_cancelled,

        /**
         * True when a ManufacturingTransaction already exists for this order_line_id.
         * Caller pre-queries the DB before building this context.
         */
        public bool $already_manufactured,
    ) {}
}
