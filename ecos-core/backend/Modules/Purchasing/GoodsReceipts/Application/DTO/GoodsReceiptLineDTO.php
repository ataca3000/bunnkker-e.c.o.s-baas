<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Application\DTO;

use App\Core\DTO\BaseDTO;

final class GoodsReceiptLineDTO extends BaseDTO
{
    public function __construct(
        public readonly string $purchase_order_line_id,
        public readonly string $product_id,
        public readonly float $ordered_quantity,
        public readonly float $received_quantity,
        public readonly float $gross_received_quantity,
        public readonly float $net_received_quantity,
        public readonly float $unit_price = 0.0,
        public readonly ?string $weight_photo_path = null,
        public readonly ?string $notes = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $net = (float) ($data['net_received_quantity'] ?? $data['received_quantity'] ?? 0);
        $gross = (float) ($data['gross_received_quantity'] ?? $net);

        return new self(
            purchase_order_line_id: (string) $data['purchase_order_line_id'],
            product_id: (string) $data['product_id'],
            ordered_quantity: (float) $data['ordered_quantity'],
            received_quantity: $net,
            gross_received_quantity: $gross,
            net_received_quantity: $net,
            unit_price: (float) ($data['unit_price'] ?? 0),
            weight_photo_path: self::nullableString($data, 'weight_photo_path'),
            notes: self::nullableString($data, 'notes'),
        );
    }

    private static function nullableString(array $data, string $key): ?string
    {
        $value = $data[$key] ?? null;

        return $value === null || $value === '' ? null : (string) $value;
    }
}
