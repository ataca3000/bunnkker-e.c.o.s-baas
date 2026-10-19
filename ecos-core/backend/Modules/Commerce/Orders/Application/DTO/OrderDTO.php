<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\DTO;

use App\Core\DTO\BaseDTO;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;

final class OrderDTO extends BaseDTO
{
    /**
     * @param  array<int, array{product_id: string, quantity: float, unit_price: float}>  $lines
     */
    public function __construct(
        public readonly string $customer_id,
        public readonly string $order_date,
        public readonly OrderStatus $status,
        public readonly array $lines,
        public readonly ?string $channel_id = null,
        public readonly ?string $external_order_id = null,
        public readonly ?string $notes = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $rawLines = is_array($data['lines'] ?? null) ? $data['lines'] : [];

        $lines = array_map(static function (mixed $line): array {
            $l = is_array($line) ? $line : [];

            return [
                'product_id' => (string) ($l['product_id'] ?? ''),
                'quantity' => (float) ($l['quantity'] ?? 0),
                'unit_price' => (float) ($l['unit_price'] ?? 0),
            ];
        }, $rawLines);

        return new self(
            customer_id: (string) $data['customer_id'],
            order_date: (string) $data['order_date'],
            status: OrderStatus::from((string) ($data['status'] ?? OrderStatus::NewOrder->value)),
            lines: $lines,
            channel_id: self::nullableString($data, 'channel_id'),
            external_order_id: self::nullableString($data, 'external_order_id'),
            notes: self::nullableString($data, 'notes'),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function orderAttributes(): array
    {
        return [
            'channel_id' => $this->channel_id,
            'customer_id' => $this->customer_id,
            'external_order_id' => $this->external_order_id,
            'order_date' => $this->order_date,
            'status' => $this->status->value,
            'notes' => $this->notes,
        ];
    }

    /**
     * @return array<int, array{product_id: string, quantity: float, unit_price: float, line_total: float}>
     */
    public function lineAttributes(): array
    {
        return array_map(static fn (array $l): array => [
            'product_id' => $l['product_id'],
            'quantity' => $l['quantity'],
            'unit_price' => $l['unit_price'],
            'line_total' => $l['quantity'] * $l['unit_price'],
        ], $this->lines);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private static function nullableString(array $data, string $key): ?string
    {
        $value = $data[$key] ?? null;

        return $value === null || $value === '' ? null : (string) $value;
    }
}
