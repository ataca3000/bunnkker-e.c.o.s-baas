<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\ValueObjects;

use InvalidArgumentException;

final readonly class ReceiptLineItem
{
    public function __construct(
        public string $productId,
        public string $productName,
        public string $sku,
        public string $quantityValue,
        public string $unitPriceAmount,
        public string $lineTotalAmount,
        public string $currency,
        public ?string $discountAmount,
        public int $sortOrder,
    ) {}

    public static function of(
        string $productId,
        string $productName,
        string $sku,
        string $quantityValue,
        string $unitPriceAmount,
        string $lineTotalAmount,
        string $currency,
        ?string $discountAmount = null,
        int $sortOrder = 0,
    ): self {
        if (trim($productId) === '') {
            throw new InvalidArgumentException('Product ID cannot be empty.');
        }
        if (trim($productName) === '') {
            throw new InvalidArgumentException('Product name cannot be empty.');
        }
        if (trim($sku) === '') {
            throw new InvalidArgumentException('SKU cannot be empty.');
        }
        if (trim($currency) === '') {
            throw new InvalidArgumentException('Currency cannot be empty.');
        }

        return new self(
            productId: trim($productId),
            productName: trim($productName),
            sku: trim($sku),
            quantityValue: $quantityValue,
            unitPriceAmount: $unitPriceAmount,
            lineTotalAmount: $lineTotalAmount,
            currency: strtoupper(trim($currency)),
            discountAmount: $discountAmount,
            sortOrder: $sortOrder,
        );
    }

    public function toArray(): array
    {
        return [
            'product_id' => $this->productId,
            'product_name' => $this->productName,
            'sku' => $this->sku,
            'quantity_value' => $this->quantityValue,
            'unit_price_amount' => $this->unitPriceAmount,
            'line_total_amount' => $this->lineTotalAmount,
            'currency' => $this->currency,
            'discount_amount' => $this->discountAmount,
            'sort_order' => $this->sortOrder,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            productId: $data['product_id'],
            productName: $data['product_name'],
            sku: $data['sku'],
            quantityValue: $data['quantity_value'],
            unitPriceAmount: $data['unit_price_amount'],
            lineTotalAmount: $data['line_total_amount'],
            currency: $data['currency'],
            discountAmount: $data['discount_amount'] ?? null,
            sortOrder: (int) ($data['sort_order'] ?? 0),
        );
    }
}
