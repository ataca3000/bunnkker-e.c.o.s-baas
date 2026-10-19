<?php

declare(strict_types=1);

namespace Modules\POS\Sale\Domain\ValueObjects;

use Modules\POS\Shared\Domain\Enums\DiscountType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;

final readonly class SaleLine
{
    public function __construct(
        public string $lineId,
        public string $productId,
        public string $productName,
        public string $sku,
        public Quantity $quantity,
        public Money $unitPrice,
        public ?DiscountType $discountType,
        public ?string $discountValue,
        public Money $lineTotal,
        public int $sortOrder,
    ) {}

    /**
     * Build a sale snapshot from a CartLine::toArray() payload.
     */
    public static function fromCartLine(array $data): self
    {
        return new self(
            lineId: $data['id'],
            productId: $data['product_id'],
            productName: $data['product_name'],
            sku: $data['sku'],
            quantity: Quantity::of($data['quantity']),
            unitPrice: Money::fromArray($data['unit_price']),
            discountType: isset($data['discount_type']) ? DiscountType::from($data['discount_type']) : null,
            discountValue: $data['discount_value'] ?? null,
            lineTotal: Money::fromArray($data['line_total']),
            sortOrder: $data['sort_order'] ?? 0,
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
            'discount_type' => $this->discountType?->value,
            'discount_value' => $this->discountValue,
            'line_total' => $this->lineTotal->toArray(),
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
            discountType: isset($data['discount_type']) ? DiscountType::from($data['discount_type']) : null,
            discountValue: $data['discount_value'] ?? null,
            lineTotal: Money::fromArray($data['line_total']),
            sortOrder: $data['sort_order'] ?? 0,
        );
    }
}
