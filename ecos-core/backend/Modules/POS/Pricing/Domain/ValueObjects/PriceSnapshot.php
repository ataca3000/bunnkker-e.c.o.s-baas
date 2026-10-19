<?php

declare(strict_types=1);

namespace Modules\POS\Pricing\Domain\ValueObjects;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use Modules\POS\Pricing\Domain\Enums\PriceSource;
use Modules\POS\Shared\Domain\ValueObjects\Money;

/**
 * Immutable audit record of the price presented to a customer at checkout.
 *
 * Extends ResolvedPrice with a snapshot UUID, the product name at the
 * moment of capture, and a precise capture timestamp.
 * Stored within CartLine or SaleLine as JSONB — no separate DB table.
 */
final readonly class PriceSnapshot
{
    public function __construct(
        public string $snapshotId,
        public string $productId,
        public string $productName,
        public Money $unitPrice,
        public PriceSource $source,
        public DateTimeImmutable $capturedAt,
    ) {}

    public static function capture(
        string $productId,
        string $productName,
        Money $unitPrice,
        PriceSource $source,
    ): self {
        if (trim($productId) === '') {
            throw new InvalidArgumentException('productId cannot be empty.');
        }
        if (trim($productName) === '') {
            throw new InvalidArgumentException('productName cannot be empty.');
        }

        return new self(
            snapshotId: self::generateUuid(),
            productId: $productId,
            productName: $productName,
            unitPrice: $unitPrice,
            source: $source,
            capturedAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
        );
    }

    public static function fromResolvedPrice(ResolvedPrice $resolved, string $productName): self
    {
        if (trim($productName) === '') {
            throw new InvalidArgumentException('productName cannot be empty.');
        }

        return new self(
            snapshotId: self::generateUuid(),
            productId: $resolved->productId,
            productName: $productName,
            unitPrice: $resolved->unitPrice,
            source: $resolved->source,
            capturedAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
        );
    }

    public function toArray(): array
    {
        return [
            'snapshot_id' => $this->snapshotId,
            'product_id' => $this->productId,
            'product_name' => $this->productName,
            'unit_price' => $this->unitPrice->toArray(),
            'source' => $this->source->value,
            'captured_at' => $this->capturedAt->format(DATE_ATOM),
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            snapshotId: $data['snapshot_id'],
            productId: $data['product_id'],
            productName: $data['product_name'],
            unitPrice: Money::fromArray($data['unit_price']),
            source: PriceSource::from($data['source']),
            capturedAt: new DateTimeImmutable($data['captured_at']),
        );
    }

    private static function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
