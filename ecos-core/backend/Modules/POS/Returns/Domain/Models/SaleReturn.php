<?php

declare(strict_types=1);

namespace Modules\POS\Returns\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use Modules\POS\Returns\Domain\Events\ReturnCancelled;
use Modules\POS\Returns\Domain\Events\ReturnInitiated;
use Modules\POS\Returns\Domain\Events\ReturnProcessed;
use Modules\POS\Returns\Domain\Exceptions\InvalidReturnTransitionException;
use Modules\POS\Returns\Domain\ValueObjects\ReturnLine;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\Enums\ReturnStatus;
use Modules\POS\Shared\Domain\ValueObjects\Money;

/**
 * SaleReturn Aggregate Root.
 *
 * Records a customer return against a previously completed Sale.
 * The aggregate holds a snapshot of which items are being returned;
 * it never reads from the live Sale after initiation.
 *
 * State machine:
 *   Pending ──process()──▶ Processed  (terminal)
 *   Pending ──cancel()───▶ Cancelled  (terminal)
 */
final class SaleReturn extends Model
{
    use HasUuids;

    protected $table = 'pos_returns';

    protected $guarded = [];

    private array $domainEvents = [];

    protected function casts(): array
    {
        return [
            'status' => ReturnStatus::class,
            'refund_method' => PaymentMethodType::class,
            'lines' => 'array',
            'refund_total' => 'array',
            'metadata' => 'array',
            'processed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    // ── Domain event collection ────────────────────────────────────────────────

    public function addEvent(DomainEvent $event): void
    {
        $this->domainEvents[] = $event;
    }

    public function pullDomainEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];

        return $events;
    }

    private static function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    // ── Factory ───────────────────────────────────────────────────────────────

    /**
     * Initiate a return against a previously completed Sale.
     *
     * @param  ReturnLine[]  $lines
     */
    public static function initiate(
        string $saleId,
        string $originalReceiptNumber,
        string $sessionId,
        string $shiftId,
        string $terminalId,
        string $cashierId,
        ?string $customerId,
        string $currency,
        string $returnNumber,
        array $lines,
        Money $refundTotal,
        PaymentMethodType $refundMethod,
        ?string $notes = null,
    ): self {
        if (trim($saleId) === '') {
            throw new InvalidArgumentException('Sale ID cannot be empty.');
        }
        if (trim($originalReceiptNumber) === '') {
            throw new InvalidArgumentException('Original receipt number cannot be empty.');
        }
        if (trim($sessionId) === '') {
            throw new InvalidArgumentException('Session ID cannot be empty.');
        }
        if (trim($shiftId) === '') {
            throw new InvalidArgumentException('Shift ID cannot be empty.');
        }
        if (trim($terminalId) === '') {
            throw new InvalidArgumentException('Terminal ID cannot be empty.');
        }
        if (trim($cashierId) === '') {
            throw new InvalidArgumentException('Cashier ID cannot be empty.');
        }
        if (trim($returnNumber) === '') {
            throw new InvalidArgumentException('Return number cannot be empty.');
        }
        if (empty($lines)) {
            throw new InvalidArgumentException('Return must have at least one line item.');
        }
        if (! $refundTotal->isPositive()) {
            throw new InvalidArgumentException('Refund total must be positive.');
        }

        $saleReturn = new self;
        $saleReturn->id = self::generateUuid();
        $saleReturn->sale_id = $saleId;
        $saleReturn->original_receipt_number = trim($originalReceiptNumber);
        $saleReturn->session_id = $sessionId;
        $saleReturn->shift_id = $shiftId;
        $saleReturn->terminal_id = $terminalId;
        $saleReturn->cashier_id = $cashierId;
        $saleReturn->customer_id = $customerId;
        $saleReturn->currency = strtoupper(trim($currency));
        $saleReturn->return_number = trim($returnNumber);
        $saleReturn->status = ReturnStatus::Pending;
        $saleReturn->lines = array_values(
            array_map(fn (ReturnLine $l) => $l->toArray(), $lines),
        );
        $saleReturn->refund_total = $refundTotal->toArray();
        $saleReturn->refund_method = $refundMethod;
        $saleReturn->notes = $notes;
        $saleReturn->processed_at = null;
        $saleReturn->cancelled_at = null;
        $saleReturn->cancelled_reason = null;

        $saleReturn->addEvent(ReturnInitiated::now(
            returnId: $saleReturn->id,
            saleId: $saleId,
            originalReceiptNumber: trim($originalReceiptNumber),
            returnNumber: trim($returnNumber),
            sessionId: $sessionId,
            shiftId: $shiftId,
            terminalId: $terminalId,
            cashierId: $cashierId,
            customerId: $customerId,
            currency: strtoupper(trim($currency)),
            refundTotal: $refundTotal->amount,
            refundMethod: $refundMethod->value,
            lineCount: count($lines),
        ));

        return $saleReturn;
    }

    // ── State transitions ─────────────────────────────────────────────────────

    /** Mark the return as processed: items received, refund issued. Pending → Processed. */
    public function process(): void
    {
        if (! $this->status->canBeProcessed()) {
            throw InvalidReturnTransitionException::cannotProcess($this->id ?? '', $this->status);
        }

        $this->status = ReturnStatus::Processed;
        $this->processed_at = now();

        $this->addEvent(ReturnProcessed::now(
            returnId: (string) $this->id,
            returnNumber: (string) $this->return_number,
            saleId: (string) $this->sale_id,
            refundTotal: $this->getRefundTotal()->amount,
            currency: (string) $this->currency,
            refundMethod: $this->refund_method->value,
        ));
    }

    /** Cancel a pending return before it is processed. Pending → Cancelled. */
    public function cancel(string $reason = ''): void
    {
        if (! $this->status->canBeCancelled()) {
            throw InvalidReturnTransitionException::cannotCancel($this->id ?? '', $this->status);
        }

        $this->status = ReturnStatus::Cancelled;
        $this->cancelled_at = now();
        $this->cancelled_reason = $reason;

        $this->addEvent(ReturnCancelled::now(
            returnId: (string) $this->id,
            returnNumber: (string) $this->return_number,
            saleId: (string) $this->sale_id,
            reason: $reason,
        ));
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    /** @return ReturnLine[] */
    public function getLines(): array
    {
        return array_map(
            fn (array $d) => ReturnLine::fromArray($d),
            $this->lines ?? [],
        );
    }

    public function getRefundTotal(): Money
    {
        return Money::fromArray($this->refund_total);
    }

    public function getLineCount(): int
    {
        return count($this->lines ?? []);
    }

    public function isPending(): bool
    {
        return $this->status === ReturnStatus::Pending;
    }

    public function isProcessed(): bool
    {
        return $this->status === ReturnStatus::Processed;
    }

    public function isCancelled(): bool
    {
        return $this->status === ReturnStatus::Cancelled;
    }
}
