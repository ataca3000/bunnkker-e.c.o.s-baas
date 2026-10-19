<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Pricing;

use InvalidArgumentException;
use Modules\POS\Pricing\Domain\Contracts\PricingGatewayInterface;
use Modules\POS\Pricing\Domain\Enums\PriceSource;
use Modules\POS\Pricing\Domain\Events\PriceResolved;
use Modules\POS\Pricing\Domain\Exceptions\InvalidPriceCurrencyException;
use Modules\POS\Pricing\Domain\Exceptions\PriceResolutionException;
use Modules\POS\Pricing\Domain\Services\PriceResolutionService;
use Modules\POS\Pricing\Domain\Services\PriceValidator;
use Modules\POS\Pricing\Domain\ValueObjects\PriceSnapshot;
use Modules\POS\Pricing\Domain\ValueObjects\ResolvedPrice;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

final class PriceResolutionServiceTest extends TestCase
{
    private PriceResolutionService $service;

    private StubPricingGateway $gateway;

    protected function setUp(): void
    {
        parent::setUp();
        $this->gateway = new StubPricingGateway;
        $this->service = new PriceResolutionService($this->gateway, new PriceValidator);
    }

    // ── resolve() ─────────────────────────────────────────────────────────────

    public function test_resolve_returns_resolved_price_from_gateway(): void
    {
        $this->gateway->addPrice('prod-001', Money::of('99.99', 'EGP'), PriceSource::RegularPrice);

        $result = $this->service->resolve('prod-001', 'EGP');

        $this->assertSame('prod-001', $result->productId);
        $this->assertTrue(Money::of('99.99', 'EGP')->equals($result->unitPrice));
        $this->assertSame(PriceSource::RegularPrice, $result->source);
    }

    public function test_resolve_throws_on_empty_product_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->service->resolve('', 'EGP');
    }

    public function test_resolve_throws_on_whitespace_only_product_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->service->resolve('  ', 'EGP');
    }

    public function test_resolve_throws_on_invalid_currency(): void
    {
        $this->expectException(InvalidPriceCurrencyException::class);
        $this->service->resolve('prod-001', 'XXX');
    }

    public function test_resolve_throws_on_empty_currency(): void
    {
        $this->expectException(InvalidPriceCurrencyException::class);
        $this->service->resolve('prod-001', '');
    }

    public function test_resolve_propagates_gateway_exception(): void
    {
        $this->expectException(PriceResolutionException::class);
        $this->service->resolve('unknown-product', 'EGP');
    }

    public function test_resolve_throws_when_price_is_zero(): void
    {
        $this->gateway->addPrice('prod-zero', Money::zero('EGP'), PriceSource::RegularPrice);

        $this->expectException(InvalidArgumentException::class);
        $this->service->resolve('prod-zero', 'EGP');
    }

    // ── Domain events ─────────────────────────────────────────────────────────

    public function test_resolve_dispatches_price_resolved_event(): void
    {
        $this->gateway->addPrice('prod-001', Money::of('50.00', 'EGP'), PriceSource::SalePrice);
        $this->service->resolve('prod-001', 'EGP');

        $events = $this->service->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(PriceResolved::class, $events[0]);
    }

    public function test_price_resolved_event_carries_correct_payload(): void
    {
        $this->gateway->addPrice('prod-001', Money::of('50.00', 'EGP'), PriceSource::SalePrice);
        $this->service->resolve('prod-001', 'EGP');

        $events = $this->service->pullDomainEvents();
        /** @var PriceResolved $event */
        $event = $events[0];

        $this->assertSame('prod-001', $event->productId);
        $this->assertSame('50.00', $event->unitPriceAmount);
        $this->assertSame('EGP', $event->currency);
        $this->assertSame(PriceSource::SalePrice->value, $event->source);
    }

    public function test_pull_domain_events_clears_queue(): void
    {
        $this->gateway->addPrice('prod-001', Money::of('10.00', 'EGP'), PriceSource::RegularPrice);
        $this->service->resolve('prod-001', 'EGP');
        $this->service->pullDomainEvents(); // clear

        $this->assertEmpty($this->service->pullDomainEvents());
    }

    // ── resolveAll() ──────────────────────────────────────────────────────────

    public function test_resolve_all_returns_keyed_array(): void
    {
        $this->gateway->addPrice('prod-001', Money::of('10.00', 'EGP'), PriceSource::RegularPrice);
        $this->gateway->addPrice('prod-002', Money::of('20.00', 'EGP'), PriceSource::SalePrice);

        $results = $this->service->resolveAll(['prod-001', 'prod-002'], 'EGP');

        $this->assertCount(2, $results);
        $this->assertArrayHasKey('prod-001', $results);
        $this->assertArrayHasKey('prod-002', $results);
        $this->assertTrue(Money::of('10.00', 'EGP')->equals($results['prod-001']->unitPrice));
        $this->assertTrue(Money::of('20.00', 'EGP')->equals($results['prod-002']->unitPrice));
    }

    public function test_resolve_all_dispatches_one_event_per_product(): void
    {
        $this->gateway->addPrice('prod-001', Money::of('10.00', 'EGP'), PriceSource::RegularPrice);
        $this->gateway->addPrice('prod-002', Money::of('20.00', 'EGP'), PriceSource::RegularPrice);
        $this->gateway->addPrice('prod-003', Money::of('30.00', 'EGP'), PriceSource::RegularPrice);

        $this->service->resolveAll(['prod-001', 'prod-002', 'prod-003'], 'EGP');

        $events = $this->service->pullDomainEvents();
        $this->assertCount(3, $events);
        foreach ($events as $e) {
            $this->assertInstanceOf(PriceResolved::class, $e);
        }
    }

    public function test_resolve_all_returns_empty_for_empty_input(): void
    {
        $results = $this->service->resolveAll([], 'EGP');
        $this->assertEmpty($results);
        $this->assertEmpty($this->service->pullDomainEvents());
    }

    public function test_resolve_all_throws_on_invalid_currency(): void
    {
        $this->expectException(InvalidPriceCurrencyException::class);
        $this->service->resolveAll(['prod-001'], 'NOPE');
    }

    // ── snapshot() ────────────────────────────────────────────────────────────

    public function test_snapshot_returns_price_snapshot(): void
    {
        $this->gateway->addPrice('prod-001', Money::of('45.00', 'EGP'), PriceSource::SalePrice);

        $snapshot = $this->service->snapshot('prod-001', 'Widget', 'EGP');

        $this->assertInstanceOf(PriceSnapshot::class, $snapshot);
        $this->assertSame('prod-001', $snapshot->productId);
        $this->assertSame('Widget', $snapshot->productName);
        $this->assertTrue(Money::of('45.00', 'EGP')->equals($snapshot->unitPrice));
        $this->assertSame(PriceSource::SalePrice, $snapshot->source);
    }

    public function test_snapshot_also_dispatches_price_resolved_event(): void
    {
        $this->gateway->addPrice('prod-001', Money::of('10.00', 'EGP'), PriceSource::RegularPrice);
        $this->service->snapshot('prod-001', 'Widget', 'EGP');

        $events = $this->service->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(PriceResolved::class, $events[0]);
    }
}

// ── Test double ───────────────────────────────────────────────────────────────

final class StubPricingGateway implements PricingGatewayInterface
{
    /** @var array<string, array{price: Money, source: PriceSource}> */
    private array $prices = [];

    public function addPrice(string $productId, Money $price, PriceSource $source): void
    {
        $this->prices[$productId] = ['price' => $price, 'source' => $source];
    }

    public function resolvePrice(string $productId, string $currency): ResolvedPrice
    {
        if (! isset($this->prices[$productId])) {
            throw PriceResolutionException::productNotFound($productId);
        }

        return ResolvedPrice::of(
            $productId,
            $this->prices[$productId]['price'],
            $this->prices[$productId]['source'],
        );
    }

    public function resolvePrices(array $productIds, string $currency): array
    {
        $resolved = [];
        foreach ($productIds as $id) {
            $resolved[$id] = $this->resolvePrice($id, $currency);
        }

        return $resolved;
    }
}
