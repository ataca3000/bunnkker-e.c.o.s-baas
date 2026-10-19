<?php

declare(strict_types=1);

namespace Modules\POS\Receipt\Domain\Models;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use Modules\POS\Receipt\Domain\Enums\ReceiptStatus;
use Modules\POS\Receipt\Domain\Enums\ReceiptType;
use Modules\POS\Receipt\Domain\Enums\ReprintReason;
use Modules\POS\Receipt\Domain\Events\ReceiptIssued;
use Modules\POS\Receipt\Domain\Events\ReceiptReprinted;
use Modules\POS\Receipt\Domain\Events\ReceiptVoided;
use Modules\POS\Receipt\Domain\Exceptions\ReceiptAlreadyVoidedException;
use Modules\POS\Receipt\Domain\Exceptions\ReprintNotAllowedException;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptLineItem;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptPayment;
use Modules\POS\Receipt\Domain\ValueObjects\ReceiptTotals;
use Modules\POS\Receipt\Domain\ValueObjects\ReprintRecord;

/**
 * Receipt Aggregate Root.
 *
 * A Receipt is an immutable business document representing proof-of-transaction.
 * It is NOT a Sale — it captures a snapshot of transaction data at time of issuance.
 *
 * Lifecycle:
 *   issue() → Issued state (normal)
 *   reprint() → increments reprint_count, appends audit record (still Issued)
 *   void() → Voided state (terminal)
 *
 * Immutability contract:
 *   Once issued, line_items, totals, payments, and all snapshot fields are frozen.
 *   Only reprint_count, reprints, status, voided_by, void_reason, voided_at may change.
 */
final class Receipt extends Model
{
    use HasUuids;

    protected $table = 'pos_receipts';

    protected $guarded = [];

    private array $domainEvents = [];

    protected function casts(): array
    {
        return [
            'type' => ReceiptType::class,
            'status' => ReceiptStatus::class,
            'line_items' => 'array',
            'payments' => 'array',
            'totals' => 'array',
            'reprints' => 'array',
            'reprint_count' => 'integer',
            'issued_at' => 'immutable_datetime',
            'voided_at' => 'immutable_datetime',
        ];
    }

    // ── Factory ───────────────────────────────────────────────────────────────

    /**
     * Issue a new Receipt for a completed transaction.
     *
     * @param  ReceiptLineItem[]  $lineItems
     * @param  ReceiptPayment[]  $payments
     */
    public static function issue(
        string $receiptNumber,
        ReceiptType $type,
        string $originalTransactionId,
        string $originalTransactionNumber,
        string $terminalId,
        string $sessionId,
        string $shiftId,
        string $cashierId,
        ?string $cashierName,
        ?string $customerId,
        ?string $customerName,
        string $currency,
        array $lineItems,
        ReceiptTotals $totals,
        array $payments,
        DateTimeImmutable $issuedAt,
        ?string $templateId = null,
    ): self {
        if (trim($receiptNumber) === '') {
            throw new InvalidArgumentException('Receipt number cannot be empty.');
        }
        if (trim($originalTransactionId) === '') {
            throw new InvalidArgumentException('Original transaction ID cannot be empty.');
        }
        if (trim($originalTransactionNumber) === '') {
            throw new InvalidArgumentException('Original transaction number cannot be empty.');
        }
        if (trim($terminalId) === '') {
            throw new InvalidArgumentException('Terminal ID cannot be empty.');
        }
        if (trim($cashierId) === '') {
            throw new InvalidArgumentException('Cashier ID cannot be empty.');
        }
        if (trim($currency) === '') {
            throw new InvalidArgumentException('Currency cannot be empty.');
        }
        if (empty($lineItems)) {
            throw new InvalidArgumentException('Receipt must have at least one line item.');
        }

        foreach ($lineItems as $item) {
            if (! $item instanceof ReceiptLineItem) {
                throw new InvalidArgumentException('Each line item must be a ReceiptLineItem instance.');
            }
        }

        foreach ($payments as $payment) {
            if (! $payment instanceof ReceiptPayment) {
                throw new InvalidArgumentException('Each payment must be a ReceiptPayment instance.');
            }
        }

        $currency = strtoupper(trim($currency));

        $receipt = new self;
        $receipt->id = self::generateUuid();
        $receipt->receipt_number = trim($receiptNumber);
        $receipt->type = $type;
        $receipt->status = ReceiptStatus::Issued;
        $receipt->original_transaction_id = $originalTransactionId;
        $receipt->original_transaction_number = trim($originalTransactionNumber);
        $receipt->terminal_id = $terminalId;
        $receipt->session_id = $sessionId ?: null;
        $receipt->shift_id = $shiftId ?: null;
        $receipt->cashier_id = $cashierId;
        $receipt->cashier_name = $cashierName !== null ? trim($cashierName) : null;
        $receipt->customer_id = $customerId;
        $receipt->customer_name = $customerName !== null ? trim($customerName) : null;
        $receipt->currency = $currency;
        $receipt->template_id = $templateId;
        $receipt->line_items = array_values(
            array_map(fn (ReceiptLineItem $l) => $l->toArray(), $lineItems),
        );
        $receipt->totals = $totals->toArray();
        $receipt->payments = array_values(
            array_map(fn (ReceiptPayment $p) => $p->toArray(), $payments),
        );
        $receipt->reprints = [];
        $receipt->reprint_count = 0;
        $receipt->void_reason = null;
        $receipt->voided_by = null;
        $receipt->voided_at = null;
        $receipt->issued_at = $issuedAt;

        $receipt->domainEvents[] = ReceiptIssued::now(
            receiptId: $receipt->id,
            receiptNumber: $receipt->receipt_number,
            type: $type->value,
            originalTransactionId: $originalTransactionId,
            originalTransactionNumber: trim($originalTransactionNumber),
            terminalId: $terminalId,
            cashierId: $cashierId,
            customerId: $customerId,
            currency: $currency,
            totalAmount: $totals->totalAmount,
            lineCount: count($lineItems),
        );

        return $receipt;
    }

    // ── Behaviour ─────────────────────────────────────────────────────────────

    /**
     * Record a reprint of this receipt.
     *
     * The receipt content is immutable — only the reprint audit grows.
     * Callers should pre-check with ReprintPolicy::canReprint() to avoid catching exceptions.
     */
    public function reprint(
        string $cashierId,
        string $terminalId,
        ReprintReason $reason,
        int $maxReprints = 10,
    ): void {
        if ($this->status !== ReceiptStatus::Issued) {
            throw ReprintNotAllowedException::receiptIsVoided($this->receipt_number);
        }

        if ($this->reprint_count >= $maxReprints) {
            throw ReprintNotAllowedException::reprintLimitReached($this->receipt_number, $maxReprints);
        }

        $record = ReprintRecord::of($cashierId, $terminalId, $reason);

        $this->reprints = array_merge($this->reprints ?? [], [$record->toArray()]);
        $this->reprint_count = ($this->reprint_count ?? 0) + 1;

        $this->domainEvents[] = ReceiptReprinted::now(
            receiptId: (string) $this->id,
            receiptNumber: $this->receipt_number,
            reprintCount: $this->reprint_count,
            cashierId: $cashierId,
            terminalId: $terminalId,
            reason: $reason->value,
        );
    }

    /**
     * Void this receipt.
     *
     * Voiding marks the receipt as cancelled; it does not reverse the underlying transaction.
     * Terminal state — a voided receipt cannot be reactivated.
     */
    public function void(string $cashierId, string $reason = ''): void
    {
        if ($this->status !== ReceiptStatus::Issued) {
            throw ReceiptAlreadyVoidedException::forReceipt($this->receipt_number);
        }

        $this->status = ReceiptStatus::Voided;
        $this->voided_by = $cashierId;
        $this->void_reason = $reason ?: null;
        $this->voided_at = new DateTimeImmutable('now', new DateTimeZone('UTC'));

        $this->domainEvents[] = ReceiptVoided::now(
            receiptId: (string) $this->id,
            receiptNumber: $this->receipt_number,
            voidedBy: $cashierId,
            voidReason: $reason,
        );
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    /** @return ReceiptLineItem[] in array form (suitable for rendering) */
    public function getLineItems(): array
    {
        return array_map(
            fn (array $d) => ReceiptLineItem::fromArray($d)->toArray(),
            $this->line_items ?? [],
        );
    }

    public function getTotals(): ReceiptTotals
    {
        return ReceiptTotals::fromArray($this->totals);
    }

    /** @return array[] in array form (suitable for rendering) */
    public function getPayments(): array
    {
        return array_map(
            fn (array $d) => ReceiptPayment::fromArray($d)->toArray(),
            $this->payments ?? [],
        );
    }

    /** @return ReprintRecord[] */
    public function getReprintRecords(): array
    {
        return array_map(
            fn (array $d) => ReprintRecord::fromArray($d),
            $this->reprints ?? [],
        );
    }

    public function getStatus(): ReceiptStatus
    {
        return $this->status;
    }

    public function isIssued(): bool
    {
        return $this->status === ReceiptStatus::Issued;
    }

    public function isVoided(): bool
    {
        return $this->status === ReceiptStatus::Voided;
    }

    public function pullDomainEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];

        return $events;
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private static function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
