<?php

declare(strict_types=1);

namespace Modules\POS\Application\Events;

use Modules\POS\Sale\Domain\ValueObjects\SaleLine;

/**
 * Immutable value object representing one line item inside SaleFinalized.
 *
 * All monetary amounts are string-encoded decimals (e.g. "49.99").
 * Must not carry Eloquent models — only scalars and primitives.
 */
final readonly class SaleItemPayload
{
    public function __construct(
        public string $lineId,
        public string $productId,
        public string $productName,
        public string $sku,
        public float $quantity,
        public string $unitPrice,
        public string $lineTotal,
        public string $currency,
    ) {}

    public static function fromSaleLine(SaleLine $line, string $currency): self
    {
        return new self(
            lineId: $line->lineId,
            productId: $line->productId,
            productName: $line->productName,
            sku: $line->sku,
            quantity: $line->quantity->toFloat(),
            unitPrice: $line->unitPrice->amount,
            lineTotal: $line->lineTotal->amount,
            currency: $currency,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'line_id' => $this->lineId,
            'product_id' => $this->productId,
            'product_name' => $this->productName,
            'sku' => $this->sku,
            'quantity' => $this->quantity,
            'unit_price' => $this->unitPrice,
            'line_total' => $this->lineTotal,
            'currency' => $this->currency,
        ];
    }
}
