<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Domain\Exceptions;

use RuntimeException;

/**
 * Thrown when code attempts to mutate Order.status directly, bypassing FulfillmentEngine.
 *
 * All status transitions must go through FulfillmentEngine::run($workflow, $order, ...).
 * Direct $order->update(['status' => ...]) calls outside the engine are architectural violations.
 */
final class UnauthorizedOrderStatusWriteException extends RuntimeException
{
    public function __construct(string $message = 'Order status must be mutated through FulfillmentEngine::run(). Direct status writes are not permitted.')
    {
        parent::__construct($message);
    }
}
