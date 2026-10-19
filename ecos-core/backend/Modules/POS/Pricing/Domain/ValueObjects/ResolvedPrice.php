<?php

declare(strict_types=1);

namespace Modules\POS\Pricing\Domain\ValueObjects;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use Modules\POS\Pricing\Domain\Enums\PriceSource;
use Modules\POS\Shared\Domain\ValueObjects\Money;

/**
 * Immutable result of a successful price resolution.
 *
 * Carries the product ID, the resolved unit price as a Money VO,
 * the source that provided the price, and the UTC timestamp of resolution.
 * The Application Layer stores this (or embeds it in CartLine) to document
 * which price was offered to the customer.
 */
final readonly class ResolvedPrice
{
    public function __construct(
        public string $productId,
        public Money $unitPrice,
        public PriceSource $source,
        public DateTimeImmutable $resolvedAt,
    ) {}

    public static function of(
        string $productId,
        Money $unitPrice,
        PriceSource $source,
    ): self {
        if (trim($productId) === '') {
            throw new InvalidArgumentException('productId cannot be empty.');
        }

        return new self(
            productId: $productId,
            unitPrice: $unitPrice,
            source: $source,
            resolvedAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
        );
    }

    public function toArray(): array
    {
        return [
            'product_id' => $this->productId,
            'unit_price' => $this->unitPrice->toArray(),
            'source' => $this->source->value,
            'resolved_at' => $this->resolvedAt->format(DATE_ATOM),
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            productId: $data['product_id'],
            unitPrice: Money::fromArray($data['unit_price']),
            source: PriceSource::from($data['source']),
            resolvedAt: new DateTimeImmutable($data['resolved_at']),
        );
    }
}
