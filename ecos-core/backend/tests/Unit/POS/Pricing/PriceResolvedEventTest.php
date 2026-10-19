<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Pricing;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Pricing\Domain\Enums\PriceSource;
use Modules\POS\Pricing\Domain\Events\PriceResolved;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

final class PriceResolvedEventTest extends TestCase
{
    // ── Contract compliance ───────────────────────────────────────────────────

    public function test_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeEvent());
    }

    public function test_event_name_is_correct(): void
    {
        $this->assertSame('pos.pricing.price_resolved', $this->makeEvent()->eventName());
    }

    public function test_event_version_is_one(): void
    {
        $this->assertSame(1, $this->makeEvent()->eventVersion());
    }

    public function test_occurred_at_is_utc(): void
    {
        $this->assertSame('UTC', $this->makeEvent()->occurredAt()->getTimezone()->getName());
    }

    public function test_event_ids_are_unique(): void
    {
        $a = $this->makeEvent();
        $b = $this->makeEvent();
        $this->assertNotSame($a->eventId(), $b->eventId());
    }

    public function test_correlation_id_equals_event_id(): void
    {
        $event = $this->makeEvent();
        $this->assertSame($event->eventId(), $event->correlationId());
    }

    // ── Payload ───────────────────────────────────────────────────────────────

    public function test_carries_product_id(): void
    {
        $event = $this->makeEvent(productId: 'prod-test');
        $this->assertSame('prod-test', $event->productId);
    }

    public function test_carries_unit_price_amount_and_currency(): void
    {
        $event = $this->makeEvent(amount: '75.50', currency: 'USD');
        $this->assertSame('75.50', $event->unitPriceAmount);
        $this->assertSame('USD', $event->currency);
    }

    public function test_carries_price_source(): void
    {
        $event = $this->makeEvent(source: PriceSource::SalePrice);
        $this->assertSame(PriceSource::SalePrice->value, $event->source);
    }

    // ── toArray() keys ────────────────────────────────────────────────────────

    public function test_to_array_contains_all_required_keys(): void
    {
        $data = $this->makeEvent()->toArray();
        foreach ([
            'event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'product_id', 'unit_price_amount', 'currency', 'source', 'resolved_at',
        ] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    public function test_to_array_event_name_matches_method(): void
    {
        $event = $this->makeEvent();
        $data = $event->toArray();
        $this->assertSame($event->eventName(), $data['event_name']);
    }

    public function test_to_array_event_version_is_one(): void
    {
        $this->assertSame(1, $this->makeEvent()->toArray()['event_version']);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function makeEvent(
        string $productId = 'prod-001',
        string $amount = '50.00',
        string $currency = 'EGP',
        PriceSource $source = PriceSource::RegularPrice,
    ): PriceResolved {
        return PriceResolved::now(
            productId: $productId,
            unitPrice: Money::of($amount, $currency),
            source: $source,
            resolvedAt: (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format(DATE_ATOM),
        );
    }
}
