<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Application\DTO;

use App\Core\DTO\BaseDTO;

/**
 * Immutable input for creating / updating a purchase order (header + lines).
 */
final class PurchaseOrderDTO extends BaseDTO
{
    /**
     * @param  list<PurchaseOrderLineDTO>  $lines
     */
    public function __construct(
        public readonly string $supplier_id,
        public readonly string $order_date,
        public readonly ?string $expected_date,
        public readonly ?string $notes,
        public readonly array $lines,
    ) {}

    public function subtotal(): float
    {
        return round(
            array_sum(array_map(fn (PurchaseOrderLineDTO $line): float => $line->lineTotal(), $this->lines)),
            2,
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $rawLines = is_array($data['lines'] ?? null) ? $data['lines'] : [];

        $lines = array_map(
            fn (mixed $line): PurchaseOrderLineDTO => PurchaseOrderLineDTO::fromArray((array) $line),
            $rawLines,
        );

        return new self(
            supplier_id: (string) $data['supplier_id'],
            order_date: (string) $data['order_date'],
            expected_date: self::nullableString($data, 'expected_date'),
            notes: self::nullableString($data, 'notes'),
            lines: array_values($lines),
        );
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
