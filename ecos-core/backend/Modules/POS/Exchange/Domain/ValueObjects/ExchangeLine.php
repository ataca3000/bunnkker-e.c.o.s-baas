<?php

declare(strict_types=1);

namespace Modules\POS\Exchange\Domain\ValueObjects;

use InvalidArgumentException;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;

/**
 * Immutable value object representing one line in an Exchange.
 *
 * Used for both returned items (customer brings back) and replacement items
 * (customer receives). Named factories distinguish the two contexts.
 *
 * lineTotal = unitPrice × quantity, computed at construction time.
 * originalLineId is populated for returned lines (traceability to the original SaleLine)
 * and null for replacement lines (new items going out).
 */
final readonly class ExchangeLine
{
    public function __construct(
        public ?string $originalLineId,
        public string $productId,
        public string $productName,
        public string $sku,
        public Quantity $quantity,
        public Money $unitPrice,
        public Money $lineTotal,
        public int $sortOrder,
    ) {}

    /**
     * Build a returned line (item the customer is bringing back).
     * Requires a reference to the original SaleLine for traceability.
     */
    public static function returned(
        string $originalLineId,
        string $productId,
        string $productName,
        string $sku,
        Quantity $quantity,
        Money $unitPrice,
        int $sortOrder = 0,
    ): self {
        if (trim($originalLineId) === '') {
            throw new InvalidArgumentException('Original line ID is required for returned exchange lines.');
        }

        return self::build($originalLineId, $productId, $productName, $sku, $quantity, $unitPrice, $sortOrder);
    }

    /**
     * Build a replacement line (item the customer is receiving in exchange).
     * No original sale line reference needed.
     */
    public static function replacement(
        string $productId,
        string $productName,
        string $sku,
        Quantity $quantity,
        Money $unitPrice,
        int $sortOrder = 0,
    ): self {
        return self::build(null, $productId, $productName, $sku, $quantity, $unitPrice, $sortOrder);
    }

    private static function build(
        ?string $originalLineId,
        string $productId,
        string $productName,
        string $sku,
        Quantity $quantity,
        Money $unitPrice,
        int $sortOrder,
    ): self {
        if (trim($productId) === '') {
            throw new InvalidArgumentException('Product ID cannot be empty.');
        }

        if (trim($productName) === '') {
            throw new InvalidArgumentException('Product name cannot be empty.');
        }

        if (! $quantity->isPositive()) {
            throw new InvalidArgumentException('Exchange line quantity must be positive.');
        }

        if ($unitPrice->isNegative()) {
            throw new InvalidArgumentException('Exchange line unit price cannot be negative.');
        }

        $lineTotal = $unitPrice->multiply($quantity->value);

        return new self(
            originalLineId: $originalLineId,
            productId: $productId,
            productName: $productName,
            sku: $sku,
            quantity: $quantity,
            unitPrice: $unitPrice,
            lineTotal: $lineTotal,
            sortOrder: $sortOrder,
        );
    }

    public function isReturnedLine(): bool
    {
        return $this->originalLineId !== null;
    }

    public function isReplacementLine(): bool
    {
        return $this->originalLineId === null;
    }

    public function toArray(): array
    {
        return [
            'original_line_id' => $this->originalLineId,
            'product_id' => $this->productId,
            'product_name' => $this->productName,
            'sku' => $this->sku,
            'quantity' => $this->quantity->value,
            'unit_price' => $this->unitPrice->toArray(),
            'line_total' => $this->lineTotal->toArray(),
            'sort_order' => $this->sortOrder,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            originalLineId: $data['original_line_id'] ?? null,
            productId: $data['product_id'],
            productName: $data['product_name'],
            sku: $data['sku'],
            quantity: Quantity::of($data['quantity']),
            unitPrice: Money::fromArray($data['unit_price']),
            lineTotal: Money::fromArray($data['line_total']),
            sortOrder: (int) ($data['sort_order'] ?? 0),
        );
    }
}
