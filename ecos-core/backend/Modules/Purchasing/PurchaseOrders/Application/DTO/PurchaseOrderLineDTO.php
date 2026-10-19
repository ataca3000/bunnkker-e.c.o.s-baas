<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Application\DTO;

use App\Core\DTO\BaseDTO;

/**
 * Immutable input for a single purchase order line.
 */
final class PurchaseOrderLineDTO extends BaseDTO
{
    public function __construct(
        public readonly string $product_id,
        public readonly float $quantity,
        public readonly float $unit_price,
    ) {}

    public function lineTotal(): float
    {
        return round($this->quantity * $this->unit_price, 2);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            product_id: (string) $data['product_id'],
            quantity: (float) $data['quantity'],
            unit_price: (float) $data['unit_price'],
        );
    }
}
