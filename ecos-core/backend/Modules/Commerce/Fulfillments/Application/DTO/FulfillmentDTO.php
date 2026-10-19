<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Application\DTO;

final class FulfillmentDTO
{
    /** @param array<int, array{product_id: string, quantity: float|int}> $lines */
    public function __construct(
        public readonly string $order_id,
        public readonly string $warehouse_id,
        public readonly string $fulfillment_date,
        public readonly string $status,
        public readonly ?string $notes,
        public readonly array $lines,
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self(
            order_id: (string) $data['order_id'],
            warehouse_id: (string) $data['warehouse_id'],
            fulfillment_date: (string) $data['fulfillment_date'],
            status: (string) ($data['status'] ?? 'pending'),
            notes: isset($data['notes']) ? (string) $data['notes'] : null,
            lines: (array) ($data['lines'] ?? []),
        );
    }

    /** @return array<string, mixed> */
    public function fulfillmentAttributes(): array
    {
        return [
            'order_id' => $this->order_id,
            'warehouse_id' => $this->warehouse_id,
            'fulfillment_date' => $this->fulfillment_date,
            'status' => $this->status,
            'notes' => $this->notes,
        ];
    }

    /** @return array<int, array<string, mixed>> */
    public function lineAttributes(): array
    {
        return array_map(
            static fn (array $line): array => [
                'product_id' => (string) $line['product_id'],
                'quantity' => (float) $line['quantity'],
            ],
            $this->lines,
        );
    }
}
