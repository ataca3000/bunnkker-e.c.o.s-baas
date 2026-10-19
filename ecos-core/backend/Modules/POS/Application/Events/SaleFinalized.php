<?php

declare(strict_types=1);

namespace Modules\POS\Application\Events;

use DateTimeImmutable;
use DateTimeZone;
use Modules\POS\Sale\Domain\Models\Sale;
use Modules\POS\Sale\Domain\ValueObjects\PaymentSummaryLine;
use Modules\POS\Sale\Domain\ValueObjects\SaleLine;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;

/**
 * POS Integration Event — published by ProcessSaleService AFTER the DB transaction commits.
 *
 * This is the single event the POS publishes to the ERP integration layer.
 * Every downstream subscriber (Inventory, Order, Accounting, Customer, Loyalty,
 * Analytics, Notifications, Webhooks) responds to this one event.
 *
 * Responsibilities of this event:
 *   - Carry the complete, enriched payload so subscribers never reload from DB.
 *   - Provide full context: company, warehouse, channel, cashier, items, payments.
 *   - Enable idempotent processing via the immutable eventId (UUID).
 *
 * Event name: "pos.sale.finalized"
 *
 * Design notes:
 *   - This is an APPLICATION-LEVEL event, not emitted by a domain aggregate.
 *     The domain aggregate emits `SaleCompleted`; this event is assembled by
 *     ProcessSaleService with data from all in-scope aggregates (Sale, Payment,
 *     Cart, Terminal, Warehouse).
 *   - Subscribers must NEVER fire directly without this event — the POS checkout
 *     flow is the only entry point.
 *   - Implements DomainEvent to travel through LaravelDomainEventPublisher.
 *
 * ADR-006: one listener per consuming module, typed to this event class.
 */
final readonly class SaleFinalized implements DomainEvent
{
    /**
     * @param  SaleItemPayload[]  $items
     * @param  SalePaymentPayload[]  $payments
     */
    public function __construct(
        private string $eventId,
        private DateTimeImmutable $occurredAt,
        public string $saleId,
        public string $receiptNumber,
        public string $companyId,
        public ?string $channelId,
        public string $warehouseId,
        public string $sessionId,
        public string $shiftId,
        public string $terminalId,
        public string $cashierId,
        public ?string $customerId,
        public array $items,
        public array $payments,
        public string $subtotal,
        public string $discountTotal,
        public string $grandTotal,
        public string $amountPaid,
        public string $changeGiven,
        public string $currency,
    ) {}

    /**
     * Assemble from the fully-resolved in-scope data available in ProcessSaleService.
     *
     * @param  SaleLine[]  $saleLines
     * @param  PaymentSummaryLine[]  $paymentSummaries
     */
    public static function fromSaleContext(
        string $saleId,
        string $receiptNumber,
        string $companyId,
        ?string $channelId,
        string $warehouseId,
        string $sessionId,
        string $shiftId,
        string $terminalId,
        string $cashierId,
        ?string $customerId,
        array $saleLines,
        array $paymentSummaries,
        string $subtotal,
        string $discountTotal,
        string $grandTotal,
        string $amountPaid,
        string $changeGiven,
        string $currency,
    ): self {
        $items = array_map(
            static fn (SaleLine $l) => SaleItemPayload::fromSaleLine($l, $currency),
            $saleLines,
        );

        $payments = array_map(
            static fn (PaymentSummaryLine $p) => SalePaymentPayload::fromPaymentSummaryLine($p),
            $paymentSummaries,
        );

        return new self(
            eventId: self::generateUuid(),
            occurredAt: new DateTimeImmutable('now', new DateTimeZone('UTC')),
            saleId: $saleId,
            receiptNumber: $receiptNumber,
            companyId: $companyId,
            channelId: $channelId,
            warehouseId: $warehouseId,
            sessionId: $sessionId,
            shiftId: $shiftId,
            terminalId: $terminalId,
            cashierId: $cashierId,
            customerId: $customerId,
            items: $items,
            payments: $payments,
            subtotal: $subtotal,
            discountTotal: $discountTotal,
            grandTotal: $grandTotal,
            amountPaid: $amountPaid,
            changeGiven: $changeGiven,
            currency: $currency,
        );
    }

    // ── DomainEvent interface ──────────────────────────────────────────────────

    public function eventId(): string
    {
        return $this->eventId;
    }

    public function eventName(): string
    {
        return 'pos.sale.finalized';
    }

    public function eventVersion(): int
    {
        return 1;
    }

    public function occurredAt(): DateTimeImmutable
    {
        return $this->occurredAt;
    }

    public function correlationId(): string
    {
        return $this->eventId;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'event_id' => $this->eventId,
            'event_name' => $this->eventName(),
            'event_version' => $this->eventVersion(),
            'occurred_at' => $this->occurredAt->format(DATE_ATOM),
            'correlation_id' => $this->correlationId(),
            'sale_id' => $this->saleId,
            'receipt_number' => $this->receiptNumber,
            'company_id' => $this->companyId,
            'channel_id' => $this->channelId,
            'warehouse_id' => $this->warehouseId,
            'session_id' => $this->sessionId,
            'shift_id' => $this->shiftId,
            'terminal_id' => $this->terminalId,
            'cashier_id' => $this->cashierId,
            'customer_id' => $this->customerId,
            'items' => array_map(static fn (SaleItemPayload $i) => $i->toArray(), $this->items),
            'payments' => array_map(static fn (SalePaymentPayload $p) => $p->toArray(), $this->payments),
            'subtotal' => $this->subtotal,
            'discount_total' => $this->discountTotal,
            'grand_total' => $this->grandTotal,
            'amount_paid' => $this->amountPaid,
            'change_given' => $this->changeGiven,
            'currency' => $this->currency,
        ];
    }

    // ── Computed helpers used by subscribers ──────────────────────────────────

    /** Total number of individual units sold (sum of quantities). */
    public function totalUnits(): float
    {
        return (float) array_sum(array_map(static fn (SaleItemPayload $i) => $i->quantity, $this->items));
    }

    /** Returns true when the sale is associated with a known (non-anonymous) customer. */
    public function hasCustomer(): bool
    {
        return $this->customerId !== null;
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    private static function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
