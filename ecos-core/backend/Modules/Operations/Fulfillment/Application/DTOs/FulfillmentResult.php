<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application\DTOs;

use Modules\Commerce\Orders\Domain\Models\Order;

final class FulfillmentResult
{
    /** @param array<string, mixed> $meta */
    private function __construct(
        public readonly bool $success,
        public readonly Order $order,
        public readonly string $message,
        public readonly array $meta = [],
    ) {}

    /** @param array<string, mixed> $meta */
    public static function success(Order $order, string $message, array $meta = []): self
    {
        return new self(true, $order, $message, $meta);
    }

    public function withMeta(string $key, mixed $value): self
    {
        return new self($this->success, $this->order, $this->message, array_merge($this->meta, [$key => $value]));
    }
}
