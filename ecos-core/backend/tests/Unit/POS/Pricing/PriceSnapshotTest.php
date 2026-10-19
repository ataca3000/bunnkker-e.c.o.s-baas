<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Pricing;

use InvalidArgumentException;
use Modules\POS\Pricing\Domain\Enums\PriceSource;
use Modules\POS\Pricing\Domain\ValueObjects\PriceSnapshot;
use Modules\POS\Pricing\Domain\ValueObjects\ResolvedPrice;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

final class PriceSnapshotTest extends TestCase
{
    // ── capture() factory ─────────────────────────────────────────────────────

    public function test_capture_creates_with_correct_fields(): void
    {
        $price = Money::of('149.99', 'EGP');
        $snapshot = PriceSnapshot::capture('prod-001', 'Widget Pro', $price, PriceSource::SalePrice);

        $this->assertSame('prod-001', $snapshot->productId);
        $this->assertSame('Widget Pro', $snapshot->productName);
        $this->assertTrue($price->equals($snapshot->unitPrice));
        $this->assertSame(PriceSource::SalePrice, $snapshot->source);
        $this->assertNotEmpty($snapshot->snapshotId);
    }

    public function test_capture_throws_on_empty_product_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PriceSnapshot::capture('', 'Widget', Money::of('10.00', 'EGP'), PriceSource::RegularPrice);
    }

    public function test_capture_throws_on_empty_product_name(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PriceSnapshot::capture('prod-001', '', Money::of('10.00', 'EGP'), PriceSource::RegularPrice);
    }

    public function test_capture_throws_on_whitespace_only_product_name(): void
    {
        $this->expectException(InvalidArgumentException::class);
        PriceSnapshot::capture('prod-001', '   ', Money::of('10.00', 'EGP'), PriceSource::RegularPrice);
    }

    public function test_captured_at_is_utc(): void
    {
        $snapshot = PriceSnapshot::capture('prod-1', 'Prod', Money::of('50.00', 'EGP'), PriceSource::RegularPrice);
        $this->assertSame('UTC', $snapshot->capturedAt->getTimezone()->getName());
    }

    public function test_snapshot_ids_are_unique(): void
    {
        $a = PriceSnapshot::capture('prod-1', 'Prod', Money::of('10.00', 'EGP'), PriceSource::RegularPrice);
        $b = PriceSnapshot::capture('prod-1', 'Prod', Money::of('10.00', 'EGP'), PriceSource::RegularPrice);
        $this->assertNotSame($a->snapshotId, $b->snapshotId);
    }

    // ── fromResolvedPrice() factory ───────────────────────────────────────────

    public function test_from_resolved_price_copies_fields(): void
    {
        $resolved = ResolvedPrice::of('prod-abc', Money::of('75.00', 'EGP'), PriceSource::RegularPrice);
        $snapshot = PriceSnapshot::fromResolvedPrice($resolved, 'Deluxe Widget');

        $this->assertSame('prod-abc', $snapshot->productId);
        $this->assertSame('Deluxe Widget', $snapshot->productName);
        $this->assertTrue($resolved->unitPrice->equals($snapshot->unitPrice));
        $this->assertSame(PriceSource::RegularPrice, $snapshot->source);
    }

    public function test_from_resolved_price_throws_on_empty_product_name(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $resolved = ResolvedPrice::of('prod-1', Money::of('10.00', 'EGP'), PriceSource::SalePrice);
        PriceSnapshot::fromResolvedPrice($resolved, '');
    }

    public function test_from_resolved_price_generates_unique_ids(): void
    {
        $resolved = ResolvedPrice::of('prod-1', Money::of('10.00', 'EGP'), PriceSource::RegularPrice);
        $a = PriceSnapshot::fromResolvedPrice($resolved, 'Prod');
        $b = PriceSnapshot::fromResolvedPrice($resolved, 'Prod');
        $this->assertNotSame($a->snapshotId, $b->snapshotId);
    }

    // ── toArray() / fromArray() ───────────────────────────────────────────────

    public function test_to_array_contains_required_keys(): void
    {
        $snapshot = PriceSnapshot::capture('prod-1', 'Widget', Money::of('50.00', 'EGP'), PriceSource::RegularPrice);
        $data = $snapshot->toArray();

        foreach (['snapshot_id', 'product_id', 'product_name', 'unit_price', 'source', 'captured_at'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    public function test_round_trip_preserves_all_fields(): void
    {
        $original = PriceSnapshot::capture('prod-123', 'Widget Pro', Money::of('199.00', 'EGP'), PriceSource::SalePrice);
        $restored = PriceSnapshot::fromArray($original->toArray());

        $this->assertSame($original->snapshotId, $restored->snapshotId);
        $this->assertSame($original->productId, $restored->productId);
        $this->assertSame($original->productName, $restored->productName);
        $this->assertTrue($original->unitPrice->equals($restored->unitPrice));
        $this->assertSame($original->source, $restored->source);
    }
}
