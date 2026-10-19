<?php

declare(strict_types=1);

namespace Modules\POS\Cart\Domain\ValueObjects;

use Modules\POS\Shared\Domain\Enums\DiscountType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;

/**
 * A single item line within a Cart.
 *
 * Immutable — all mutation returns a new instance.
 * Line total = (unitPrice × quantity) − discountAmount.
 * Product name and SKU are denormalised for receipt printing.
 */
final readonly class CartLine
{
    public function __construct(
        public string $id,
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

    public static function create(
        string $productId,
        string $productName,
        string $sku,
        Quantity $quantity,
        Money $unitPrice,
        ?DiscountType $discountType = null,
        ?string $discountValue = null,
        int $sortOrder = 0,
    ): self {
        $lineTotal = self::computeLineTotal($quantity, $unitPrice, $discountType, $discountValue);

        return new self(
            id: self::generateUuid(),
            productId: $productId,
            productName: $productName,
            sku: $sku,
            quantity: $quantity,
            unitPrice: $unitPrice,
            discountType: $discountType,
            discountValue: $discountValue,
            lineTotal: $lineTotal,
            sortOrder: $sortOrder,
        );
    }

    public function withQuantity(Quantity $newQuantity): self
    {
        return new self(
            id: $this->id,
            productId: $this->productId,
            productName: $this->productName,
            sku: $this->sku,
            quantity: $newQuantity,
            unitPrice: $this->unitPrice,
            discountType: $this->discountType,
            discountValue: $this->discountValue,
            lineTotal: self::computeLineTotal($newQuantity, $this->unitPrice, $this->discountType, $this->discountValue),
            sortOrder: $this->sortOrder,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
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
        $discountType = isset($data['discount_type']) && $data['discount_type'] !== null
            ? DiscountType::from($data['discount_type'])
            : null;

        return new self(
            id: $data['id'],
            productId: $data['product_id'],
            productName: $data['product_name'],
            sku: $data['sku'],
            quantity: Quantity::of($data['quantity']),
            unitPrice: Money::fromArray($data['unit_price']),
            discountType: $discountType,
            discountValue: $data['discount_value'] ?? null,
            lineTotal: Money::fromArray($data['line_total']),
            sortOrder: (int) ($data['sort_order'] ?? 0),
        );
    }

    private static function computeLineTotal(
        Quantity $quantity,
        Money $unitPrice,
        ?DiscountType $discountType,
        ?string $discountValue,
    ): Money {
        $lineSubtotal = $unitPrice->multiply($quantity->value);

        if ($discountType !== null && $discountValue !== null) {
            $discountAmount = $discountType->computeAmount($lineSubtotal, $discountValue);

            return $lineSubtotal->subtract($discountAmount);
        }

        return $lineSubtotal;
    }

    private static function generateUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0F | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3F | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
