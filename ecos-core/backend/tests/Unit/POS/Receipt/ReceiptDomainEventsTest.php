<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Receipt;

use DateTimeImmutable;
use Modules\POS\Receipt\Domain\Events\ReceiptIssued;
use Modules\POS\Receipt\Domain\Events\ReceiptReprinted;
use Modules\POS\Receipt\Domain\Events\ReceiptVoided;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use PHPUnit\Framework\TestCase;

final class ReceiptDomainEventsTest extends TestCase
{
    // ── ReceiptIssued ─────────────────────────────────────────────────────────

    public function test_receipt_issued_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeIssued());
    }

    public function test_receipt_issued_event_name(): void
    {
        $this->assertSame('pos.receipt.issued', $this->makeIssued()->eventName());
    }

    public function test_receipt_issued_version_is_one(): void
    {
        $this->assertSame(1, $this->makeIssued()->eventVersion());
    }

    public function test_receipt_issued_occurred_at_is_utc(): void
    {
        $event = $this->makeIssued();

        $this->assertInstanceOf(DateTimeImmutable::class, $event->occurredAt());
        $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
    }

    public function test_receipt_issued_unique_event_ids(): void
    {
        $e1 = $this->makeIssued();
        $e2 = $this->makeIssued();

        $this->assertNotSame($e1->eventId(), $e2->eventId());
    }

    public function test_receipt_issued_correlation_id_equals_event_id(): void
    {
        $event = $this->makeIssued();

        $this->assertSame($event->eventId(), $event->correlationId());
    }

    public function test_receipt_issued_to_array_keys(): void
    {
        $array = $this->makeIssued()->toArray();

        $this->assertArrayHasKey('event_id', $array);
        $this->assertArrayHasKey('event_name', $array);
        $this->assertArrayHasKey('occurred_at', $array);
        $this->assertArrayHasKey('event_version', $array);
        $this->assertArrayHasKey('correlation_id', $array);
        $this->assertArrayHasKey('receipt_id', $array);
        $this->assertArrayHasKey('receipt_number', $array);
        $this->assertArrayHasKey('type', $array);
        $this->assertArrayHasKey('original_transaction_id', $array);
        $this->assertArrayHasKey('original_transaction_number', $array);
        $this->assertArrayHasKey('terminal_id', $array);
        $this->assertArrayHasKey('cashier_id', $array);
        $this->assertArrayHasKey('customer_id', $array);
        $this->assertArrayHasKey('currency', $array);
        $this->assertArrayHasKey('total_amount', $array);
        $this->assertArrayHasKey('line_count', $array);
    }

    // ── ReceiptReprinted ──────────────────────────────────────────────────────

    public function test_receipt_reprinted_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeReprinted());
    }

    public function test_receipt_reprinted_event_name(): void
    {
        $this->assertSame('pos.receipt.reprinted', $this->makeReprinted()->eventName());
    }

    public function test_receipt_reprinted_version_is_one(): void
    {
        $this->assertSame(1, $this->makeReprinted()->eventVersion());
    }

    public function test_receipt_reprinted_occurred_at_is_utc(): void
    {
        $event = $this->makeReprinted();

        $this->assertInstanceOf(DateTimeImmutable::class, $event->occurredAt());
        $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
    }

    public function test_receipt_reprinted_unique_ids(): void
    {
        $e1 = $this->makeReprinted();
        $e2 = $this->makeReprinted();

        $this->assertNotSame($e1->eventId(), $e2->eventId());
    }

    public function test_receipt_reprinted_to_array_keys(): void
    {
        $array = $this->makeReprinted()->toArray();

        $this->assertArrayHasKey('event_id', $array);
        $this->assertArrayHasKey('receipt_id', $array);
        $this->assertArrayHasKey('receipt_number', $array);
        $this->assertArrayHasKey('reprint_count', $array);
        $this->assertArrayHasKey('cashier_id', $array);
        $this->assertArrayHasKey('terminal_id', $array);
        $this->assertArrayHasKey('reason', $array);
    }

    // ── ReceiptVoided ─────────────────────────────────────────────────────────

    public function test_receipt_voided_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->makeVoided());
    }

    public function test_receipt_voided_event_name(): void
    {
        $this->assertSame('pos.receipt.voided', $this->makeVoided()->eventName());
    }

    public function test_receipt_voided_version_is_one(): void
    {
        $this->assertSame(1, $this->makeVoided()->eventVersion());
    }

    public function test_receipt_voided_occurred_at_is_utc(): void
    {
        $event = $this->makeVoided();

        $this->assertInstanceOf(DateTimeImmutable::class, $event->occurredAt());
        $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
    }

    public function test_receipt_voided_unique_ids(): void
    {
        $e1 = $this->makeVoided();
        $e2 = $this->makeVoided();

        $this->assertNotSame($e1->eventId(), $e2->eventId());
    }

    public function test_receipt_voided_to_array_keys(): void
    {
        $array = $this->makeVoided()->toArray();

        $this->assertArrayHasKey('event_id', $array);
        $this->assertArrayHasKey('receipt_id', $array);
        $this->assertArrayHasKey('receipt_number', $array);
        $this->assertArrayHasKey('voided_by', $array);
        $this->assertArrayHasKey('void_reason', $array);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeIssued(): ReceiptIssued
    {
        return ReceiptIssued::now(
            receiptId: 'rcpt-1',
            receiptNumber: 'RCP-20260701-T01-00001',
            type: 'sale',
            originalTransactionId: 'sale-1',
            originalTransactionNumber: 'SALE-0001',
            terminalId: 'term-1',
            cashierId: 'usr-1',
            customerId: null,
            currency: 'EGP',
            totalAmount: '114.00',
            lineCount: 2,
        );
    }

    private function makeReprinted(): ReceiptReprinted
    {
        return ReceiptReprinted::now(
            receiptId: 'rcpt-1',
            receiptNumber: 'RCP-20260701-T01-00001',
            reprintCount: 1,
            cashierId: 'usr-1',
            terminalId: 'term-1',
            reason: 'customer_request',
        );
    }

    private function makeVoided(): ReceiptVoided
    {
        return ReceiptVoided::now(
            receiptId: 'rcpt-1',
            receiptNumber: 'RCP-20260701-T01-00001',
            voidedBy: 'usr-1',
            voidReason: 'Duplicate receipt',
        );
    }
}
