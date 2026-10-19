<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\DTOs;

use InvalidArgumentException;
use Modules\Commerce\Orders\Domain\Models\Order;

/**
 * Carries the order and caller-supplied payload into a workflow.
 */
final class FulfillmentContext
{
    /** @param array<string, mixed> $data */
    public function __construct(
        public readonly Order $order,
        public readonly array $data = [],
        public readonly ?string $actorId = null,
    ) {}

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->data[$key] ?? $default;
    }

    public function require(string $key): mixed
    {
        if (! array_key_exists($key, $this->data)) {
            throw new InvalidArgumentException("FulfillmentContext: required key '{$key}' is missing.");
        }

        return $this->data[$key];
    }
}
