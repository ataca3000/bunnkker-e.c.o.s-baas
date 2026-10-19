<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Exchange;

use DateTimeImmutable;
use Modules\POS\Exchange\Domain\Events\ExchangeCancelled;
use Modules\POS\Exchange\Domain\Events\ExchangeCompleted;
use Modules\POS\Exchange\Domain\Events\ExchangeConfirmed;
use Modules\POS\Exchange\Domain\Events\ExchangeInitiated;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use PHPUnit\Framework\TestCase;

final class ExchangeDomainEventsTest extends TestCase
{
    // ── ExchangeInitiated ─────────────────────────────────────────────────────

    public function test_exchange_initiated_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeInitiated());
    }

    public function test_exchange_initiated_event_name(): void
    {
        $this->assertSame('pos.exchange.initiated', $this->makeInitiated()->eventName());
    }

    public function test_exchange_initiated_version_is_one(): void
    {
        $this->assertSame(1, $this->makeInitiated()->eventVersion());
    }

    public function test_exchange_initiated_occurred_at_is_utc(): void
    {
        $event = $this->makeInitiated();

        $this->assertInstanceOf(DateTimeImmutable::class, $event->occurredAt());
        $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
    }

    public function test_exchange_initiated_unique_event_ids(): void
    {
        $e1 = $this->makeInitiated();
        $e2 = $this->makeInitiated();

        $this->assertNotSame($e1->eventId(), $e2->eventId());
    }

    public function test_exchange_initiated_correlation_id_equals_event_id(): void
    {
        $event = $this->makeInitiated();

        $this->assertSame($event->eventId(), $event->correlationId());
    }

    public function test_exchange_initiated_to_array_keys(): void
    {
        $array = $this->makeInitiated()->toArray();

        $this->assertArrayHasKey('event_id', $array);
        $this->assertArrayHasKey('event_name', $array);
        $this->assertArrayHasKey('occurred_at', $array);
        $this->assertArrayHasKey('event_version', $array);
        $this->assertArrayHasKey('correlation_id', $array);
        $this->assertArrayHasKey('exchange_id', $array);
        $this->assertArrayHasKey('exchange_number', $array);
        $this->assertArrayHasKey('original_sale_id', $array);
        $this->assertArrayHasKey('original_sale_number', $array);
        $this->assertArrayHasKey('terminal_id', $array);
        $this->assertArrayHasKey('cashier_id', $array);
        $this->assertArrayHasKey('customer_id', $array);
        $this->assertArrayHasKey('currency', $array);
        $this->assertArrayHasKey('reason', $array);
        $this->assertArrayHasKey('returned_line_count', $array);
        $this->assertArrayHasKey('replacement_line_count', $array);
    }

    // ── ExchangeConfirmed ─────────────────────────────────────────────────────

    public function test_exchange_confirmed_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeConfirmed());
    }

    public function test_exchange_confirmed_event_name(): void
    {
        $this->assertSame('pos.exchange.confirmed', $this->makeConfirmed()->eventName());
    }

    public function test_exchange_confirmed_version_is_one(): void
    {
        $this->assertSame(1, $this->makeConfirmed()->eventVersion());
    }

    public function test_exchange_confirmed_occurred_at_is_utc(): void
    {
        $event = $this->makeConfirmed();

        $this->assertInstanceOf(DateTimeImmutable::class, $event->occurredAt());
        $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
    }

    public function test_exchange_confirmed_unique_ids(): void
    {
        $e1 = $this->makeConfirmed();
        $e2 = $this->makeConfirmed();

        $this->assertNotSame($e1->eventId(), $e2->eventId());
    }

    public function test_exchange_confirmed_to_array_keys(): void
    {
        $array = $this->makeConfirmed()->toArray();

        $this->assertArrayHasKey('event_id', $array);
        $this->assertArrayHasKey('exchange_id', $array);
        $this->assertArrayHasKey('exchange_number', $array);
        $this->assertArrayHasKey('returned_total_amount', $array);
        $this->assertArrayHasKey('replacement_total_amount', $array);
        $this->assertArrayHasKey('currency', $array);
    }

    // ── ExchangeCompleted ─────────────────────────────────────────────────────

    public function test_exchange_completed_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeCompleted());
    }

    public function test_exchange_completed_event_name(): void
    {
        $this->assertSame('pos.exchange.completed', $this->makeCompleted()->eventName());
    }

    public function test_exchange_completed_version_is_one(): void
    {
        $this->assertSame(1, $this->makeCompleted()->eventVersion());
    }

    public function test_exchange_completed_occurred_at_is_utc(): void
    {
        $event = $this->makeCompleted();

        $this->assertInstanceOf(DateTimeImmutable::class, $event->occurredAt());
        $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
    }

    public function test_exchange_completed_to_array_keys(): void
    {
        $array = $this->makeCompleted()->toArray();

        $this->assertArrayHasKey('event_id', $array);
        $this->assertArrayHasKey('exchange_id', $array);
        $this->assertArrayHasKey('original_sale_id', $array);
        $this->assertArrayHasKey('returned_total_amount', $array);
        $this->assertArrayHasKey('replacement_total_amount', $array);
        $this->assertArrayHasKey('value_difference_amount', $array);
        $this->assertArrayHasKey('currency', $array);
    }

    // ── ExchangeCancelled ─────────────────────────────────────────────────────

    public function test_exchange_cancelled_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeCancelled());
    }

    public function test_exchange_cancelled_event_name(): void
    {
        $this->assertSame('pos.exchange.cancelled', $this->makeCancelled()->eventName());
    }

    public function test_exchange_cancelled_version_is_one(): void
    {
        $this->assertSame(1, $this->makeCancelled()->eventVersion());
    }

    public function test_exchange_cancelled_occurred_at_is_utc(): void
    {
        $event = $this->makeCancelled();

        $this->assertInstanceOf(DateTimeImmutable::class, $event->occurredAt());
        $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
    }

    public function test_exchange_cancelled_unique_ids(): void
    {
        $e1 = $this->makeCancelled();
        $e2 = $this->makeCancelled();

        $this->assertNotSame($e1->eventId(), $e2->eventId());
    }

    public function test_exchange_cancelled_to_array_keys(): void
    {
        $array = $this->makeCancelled()->toArray();

        $this->assertArrayHasKey('event_id', $array);
        $this->assertArrayHasKey('exchange_id', $array);
        $this->assertArrayHasKey('exchange_number', $array);
        $this->assertArrayHasKey('cancelled_from_status', $array);
        $this->assertArrayHasKey('cancelled_reason', $array);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeInitiated(): ExchangeInitiated
    {
        return ExchangeInitiated::now(
            exchangeId: 'exc-1',
            exchangeNumber: 'EXC-001',
            originalSaleId: 'sale-1',
            originalSaleNumber: 'SALE-001',
            terminalId: 'term-1',
            cashierId: 'usr-1',
            customerId: null,
            currency: 'EGP',
            reason: 'defective',
            returnedLineCount: 1,
            replacementLineCount: 1,
        );
    }

    private function makeConfirmed(): ExchangeConfirmed
    {
        return ExchangeConfirmed::now(
            exchangeId: 'exc-1',
            exchangeNumber: 'EXC-001',
            returnedTotalAmount: '100.00',
            replacementTotalAmount: '120.00',
            currency: 'EGP',
        );
    }

    private function makeCompleted(): ExchangeCompleted
    {
        return ExchangeCompleted::now(
            exchangeId: 'exc-1',
            exchangeNumber: 'EXC-001',
            originalSaleId: 'sale-1',
            returnedTotalAmount: '100.00',
            replacementTotalAmount: '120.00',
            valueDifferenceAmount: '20.00',
            currency: 'EGP',
        );
    }

    private function makeCancelled(): ExchangeCancelled
    {
        return ExchangeCancelled::now(
            exchangeId: 'exc-1',
            exchangeNumber: 'EXC-001',
            cancelledFromStatus: 'draft',
            cancelledReason: 'Customer changed mind',
        );
    }
}
