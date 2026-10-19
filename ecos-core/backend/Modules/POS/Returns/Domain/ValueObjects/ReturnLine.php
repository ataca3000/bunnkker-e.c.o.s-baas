<?php

declare(strict_types=1);

namespace Modules\POS\Returns\Domain\ValueObjects;

use InvalidArgumentException;
use Modules\POS\Shared\Domain\Enums\ReturnReason;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;

/**
 * Immutable value object representing one line item in a customer return.
 *
 * Built from a SaleLine::toArray() payload at the Application layer boundary.
 * The refundAmount is computed from unitPrice × returnQuantity.
 */
final readonly class ReturnLine
{
    public function __construct(
        public string $lineId,        // SaleLine.lineId for traceability
        public string $productId,
        public string $productName,
        public string $sku,
        public Quantity $quantity,
        public Money $unitPrice,
        public Money $refundAmount,  // unitPrice × quantity
        public ReturnReason $reason,
        public bool $shouldRestock, // delegated from ReturnReason::shouldRestock()
        public int $sortOrder,
    ) {}

    /**
     * Build a ReturnLine from a SaleLine::toArray() payload.
     * The Application layer passes returnQty and reason; refundAmount is computed here.
     */
    public static function fromSaleLine(
        array $saleLine,
        Quantity $returnQty,
        ReturnReason $reason,
        int $sortOrder = 0,
    ): self {
        if (! $returnQty->isPositive()) {
            throw new InvalidArgumentException('Return quantity must be positive.');
        }

        $unitPrice = Money::fromArray($saleLine['unit_price']);
        $refundAmount = $unitPrice->multiply($returnQty->value);

        return new self(
            lineId: $saleLine['line_id'],
            productId: $saleLine['product_id'],
            productName: $saleLine['product_name'],
            sku: $saleLine['sku'],
            quantity: $returnQty,
            unitPrice: $unitPrice,
            refundAmount: $refundAmount,
            reason: $reason,
            shouldRestock: $reason->shouldRestock(),
            sortOrder: $sortOrder,
        );
    }

    public function toArray(): array
    {
        return [
            'line_id' => $this->lineId,
            'product_id' => $this->productId,
            'product_name' => $this->productName,
            'sku' => $this->sku,
            'quantity' => $this->quantity->value,
            'unit_price' => $this->unitPrice->toArray(),
            'refund_amount' => $this->refundAmount->toArray(),
            'reason' => $this->reason->value,
            'should_restock' => $this->shouldRestock,
            'sort_order' => $this->sortOrder,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            lineId: $data['line_id'],
            productId: $data['product_id'],
            productName: $data['product_name'],
            sku: $data['sku'],
            quantity: Quantity::of($data['quantity']),
            unitPrice: Money::fromArray($data['unit_price']),
            refundAmount: Money::fromArray($data['refund_amount']),
            reason: ReturnReason::from($data['reason']),
            shouldRestock: (bool) $data['should_restock'],
            sortOrder: (int) $data['sort_order'],
        );
    }
}
