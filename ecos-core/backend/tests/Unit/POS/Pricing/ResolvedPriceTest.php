<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Pricing;

use InvalidArgumentException;
use Modules\POS\Pricing\Domain\Enums\PriceSource;
use Modules\POS\Pricing\Domain\ValueObjects\ResolvedPrice;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

final class ResolvedPriceTest extends TestCase
{
    // ── of() factory ──────────────────────────────────────────────────────────

    public function test_of_creates_with_correct_fields(): void
    {
        $price = Money::of('99.99', 'EGP');
        $resolved = ResolvedPrice::of('prod-001', $price, PriceSource::RegularPrice);

        $this->assertSame('prod-001', $resolved->productId);
        $this->assertTrue($price->equals($resolved->unitPrice));
        $this->assertSame(PriceSource::RegularPrice, $resolved->source);
    }

    public function test_of_throws_on_empty_product_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        ResolvedPrice::of('', Money::of('10.00', 'EGP'), PriceSource::RegularPrice);
    }

    public function test_of_throws_on_whitespace_only_product_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        ResolvedPrice::of('   ', Money::of('10.00', 'EGP'), PriceSource::RegularPrice);
    }

    public function test_resolved_at_is_utc(): void
    {
        $resolved = ResolvedPrice::of('prod-001', Money::of('50.00', 'EGP'), PriceSource::SalePrice);
        $this->assertSame('UTC', $resolved->resolvedAt->getTimezone()->getName());
    }

    // ── toArray() / fromArray() ───────────────────────────────────────────────

    public function test_to_array_contains_required_keys(): void
    {
        $resolved = ResolvedPrice::of('prod-001', Money::of('25.00', 'EGP'), PriceSource::RegularPrice);
        $data = $resolved->toArray();

        foreach (['product_id', 'unit_price', 'source', 'resolved_at'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    public function test_to_array_unit_price_has_amount_and_currency(): void
    {
        $resolved = ResolvedPrice::of('prod-001', Money::of('25.00', 'EGP'), PriceSource::RegularPrice);
        $data = $resolved->toArray();

        $this->assertArrayHasKey('amount', $data['unit_price']);
        $this->assertArrayHasKey('currency', $data['unit_price']);
        $this->assertSame('25.00', $data['unit_price']['amount']);
        $this->assertSame('EGP', $data['unit_price']['currency']);
    }

    public function test_round_trip_regular_price(): void
    {
        $original = ResolvedPrice::of('prod-abc', Money::of('199.99', 'EGP'), PriceSource::RegularPrice);
        $restored = ResolvedPrice::fromArray($original->toArray());

        $this->assertSame($original->productId, $restored->productId);
        $this->assertTrue($original->unitPrice->equals($restored->unitPrice));
        $this->assertSame($original->source, $restored->source);
    }

    public function test_round_trip_sale_price(): void
    {
        $original = ResolvedPrice::of('prod-xyz', Money::of('79.50', 'USD'), PriceSource::SalePrice);
        $restored = ResolvedPrice::fromArray($original->toArray());

        $this->assertSame('prod-xyz', $restored->productId);
        $this->assertSame(PriceSource::SalePrice, $restored->source);
        $this->assertSame('USD', $restored->unitPrice->currency);
    }

    public function test_round_trip_manual(): void
    {
        $original = ResolvedPrice::of('prod-1', Money::of('5.00', 'EGP'), PriceSource::Manual);
        $restored = ResolvedPrice::fromArray($original->toArray());

        $this->assertSame(PriceSource::Manual, $restored->source);
    }
}
