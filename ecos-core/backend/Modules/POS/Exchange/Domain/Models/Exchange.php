<?php

declare(strict_types=1);

namespace Modules\POS\Exchange\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use Modules\POS\Exchange\Domain\Enums\ExchangeReason;
use Modules\POS\Exchange\Domain\Enums\ExchangeStatus;
use Modules\POS\Exchange\Domain\Events\ExchangeCancelled;
use Modules\POS\Exchange\Domain\Events\ExchangeCompleted;
use Modules\POS\Exchange\Domain\Events\ExchangeConfirmed;
use Modules\POS\Exchange\Domain\Events\ExchangeInitiated;
use Modules\POS\Exchange\Domain\Exceptions\InvalidExchangeTransitionException;
use Modules\POS\Exchange\Domain\ValueObjects\ExchangeLine;
use Modules\POS\Shared\Domain\ValueObjects\Money;

/**
 * Exchange Aggregate Root.
 *
 * Records a product exchange against a previously completed Sale.
 * The aggregate holds snapshots of both returned items (coming back from the customer)
 * and replacement items (going out to the customer).
 *
 * It never reads from live Sale, Cart, Inventory, or Accounting state.
 *
 * State machine:
 *   Draft ──confirm()───▶ Confirmed ──complete()──▶ Completed (terminal)
 *   Draft ──cancel()────▶ Cancelled (terminal)
 *   Confirmed ──cancel()─▶ Cancelled (terminal)
 */
final class Exchange extends Model
{
    use HasUuids;

    protected $table = 'pos_exchanges';

    protected $guarded = [];

    private array $domainEvents = [];

    protected function casts(): array
    {
        return [
            'status' => ExchangeStatus::class,
            'reason' => ExchangeReason::class,
            'returned_lines' => 'array',
            'replacement_lines' => 'array',
            'returned_total' => 'array',
            'replacement_total' => 'array',
            'confirmed_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    // ── Factory ───────────────────────────────────────────────────────────────

    /**
     * Initiate a new Exchange against a previously completed Sale.
     *
     * @param  ExchangeLine[]  $returnedLines  Items the customer is returning
     * @param  ExchangeLine[]  $replacementLines  Items the customer is receiving
     */
    public static function initiate(
        string $exchangeNumber,
        string $originalSaleId,
        string $originalSaleNumber,
        string $terminalId,
        string $sessionId,
        string $shiftId,
        string $cashierId,
        ?string $customerId,
        string $currency,
        array $returnedLines,
        array $replacementLines,
        ExchangeReason $reason,
        ?string $notes = null,
    ): self {
        if (trim($exchangeNumber) === '') {
            throw new InvalidArgumentException('Exchange number cannot be empty.');
        }
        if (trim($originalSaleId) === '') {
            throw new InvalidArgumentException('Original sale ID cannot be empty.');
        }
        if (trim($originalSaleNumber) === '') {
            throw new InvalidArgumentException('Original sale number cannot be empty.');
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
        if (empty($returnedLines)) {
            throw new InvalidArgumentException('Exchange must have at least one returned line.');
        }
        if (empty($replacementLines)) {
            throw new InvalidArgumentException('Exchange must have at least one replacement line.');
        }

        foreach ($returnedLines as $line) {
            if (! $line instanceof ExchangeLine) {
                throw new InvalidArgumentException(
                    'Each returned line must be an ExchangeLine instance.',
                );
            }
        }

        foreach ($replacementLines as $line) {
            if (! $line instanceof ExchangeLine) {
                throw new InvalidArgumentException(
                    'Each replacement line must be an ExchangeLine instance.',
                );
            }
        }

        $currency = strtoupper(trim($currency));

        $returnedTotal = self::sumLines($returnedLines, $currency);
        $replacementTotal = self::sumLines($replacementLines, $currency);

        $exchange = new self;
        $exchange->id = self::generateUuid();
        $exchange->exchange_number = trim($exchangeNumber);
        $exchange->original_sale_id = $originalSaleId;
        $exchange->original_sale_number = trim($originalSaleNumber);
        $exchange->terminal_id = $terminalId;
        $exchange->session_id = $sessionId ?: null;
        $exchange->shift_id = $shiftId ?: null;
        $exchange->cashier_id = $cashierId;
        $exchange->customer_id = $customerId;
        $exchange->currency = $currency;
        $exchange->status = ExchangeStatus::Draft;
        $exchange->reason = $reason;
        $exchange->returned_lines = array_values(
            array_map(fn (ExchangeLine $l) => $l->toArray(), $returnedLines),
        );
        $exchange->replacement_lines = array_values(
            array_map(fn (ExchangeLine $l) => $l->toArray(), $replacementLines),
        );
        $exchange->returned_total = $returnedTotal->toArray();
        $exchange->replacement_total = $replacementTotal->toArray();
        $exchange->notes = $notes;
        $exchange->confirmed_at = null;
        $exchange->completed_at = null;
        $exchange->cancelled_at = null;
        $exchange->cancelled_reason = null;

        $exchange->domainEvents[] = ExchangeInitiated::now(
            exchangeId: $exchange->id,
            exchangeNumber: $exchange->exchange_number,
            originalSaleId: $originalSaleId,
            originalSaleNumber: trim($originalSaleNumber),
            terminalId: $terminalId,
            cashierId: $cashierId,
            customerId: $customerId,
            currency: $currency,
            reason: $reason->value,
            returnedLineCount: count($returnedLines),
            replacementLineCount: count($replacementLines),
        );

        return $exchange;
    }

    // ── State transitions ─────────────────────────────────────────────────────

    /** Confirm the exchange lines are valid and the exchange is ready to execute. Draft → Confirmed. */
    public function confirm(): void
    {
        if (! $this->status->canBeConfirmed()) {
            throw InvalidExchangeTransitionException::cannotTransition(
                $this->status,
                ExchangeStatus::Confirmed,
            );
        }

        $this->status = ExchangeStatus::Confirmed;
        $this->confirmed_at = now();

        $this->domainEvents[] = ExchangeConfirmed::now(
            exchangeId: (string) $this->id,
            exchangeNumber: $this->exchange_number,
            returnedTotalAmount: $this->getReturnedTotal()->amount,
            replacementTotalAmount: $this->getReplacementTotal()->amount,
            currency: $this->currency,
        );
    }

    /** Mark the exchange as completed: items physically exchanged. Confirmed → Completed. */
    public function complete(): void
    {
        if (! $this->status->canBeCompleted()) {
            throw InvalidExchangeTransitionException::cannotTransition(
                $this->status,
                ExchangeStatus::Completed,
            );
        }

        $this->status = ExchangeStatus::Completed;
        $this->completed_at = now();

        $diff = $this->getValueDifference();

        $this->domainEvents[] = ExchangeCompleted::now(
            exchangeId: (string) $this->id,
            exchangeNumber: $this->exchange_number,
            originalSaleId: $this->original_sale_id,
            returnedTotalAmount: $this->getReturnedTotal()->amount,
            replacementTotalAmount: $this->getReplacementTotal()->amount,
            valueDifferenceAmount: $diff->amount,
            currency: $this->currency,
        );
    }

    /** Cancel the exchange before it is completed. Draft|Confirmed → Cancelled. */
    public function cancel(string $reason = ''): void
    {
        if (! $this->status->canBeCancelled()) {
            throw InvalidExchangeTransitionException::cannotTransition(
                $this->status,
                ExchangeStatus::Cancelled,
            );
        }

        $previousStatus = $this->status;
        $this->status = ExchangeStatus::Cancelled;
        $this->cancelled_at = now();
        $this->cancelled_reason = $reason ?: null;

        $this->domainEvents[] = ExchangeCancelled::now(
            exchangeId: (string) $this->id,
            exchangeNumber: $this->exchange_number,
            cancelledFromStatus: $previousStatus->value,
            cancelledReason: $reason,
        );
    }

    // ── Computed values ───────────────────────────────────────────────────────

    public function getReturnedTotal(): Money
    {
        return Money::fromArray($this->returned_total);
    }

    public function getReplacementTotal(): Money
    {
        return Money::fromArray($this->replacement_total);
    }

    /**
     * Monetary difference: replacementTotal − returnedTotal.
     * Positive  → customer owes the difference.
     * Negative  → store owes the customer the difference.
     * Zero      → even exchange.
     */
    public function getValueDifference(): Money
    {
        return $this->getReplacementTotal()->subtract($this->getReturnedTotal());
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    /** @return ExchangeLine[] */
    public function getReturnedLines(): array
    {
        return array_map(
            fn (array $d) => ExchangeLine::fromArray($d),
            $this->returned_lines ?? [],
        );
    }

    /** @return ExchangeLine[] */
    public function getReplacementLines(): array
    {
        return array_map(
            fn (array $d) => ExchangeLine::fromArray($d),
            $this->replacement_lines ?? [],
        );
    }

    public function getReturnedLineCount(): int
    {
        return count($this->returned_lines ?? []);
    }

    public function getReplacementLineCount(): int
    {
        return count($this->replacement_lines ?? []);
    }

    public function getStatus(): ExchangeStatus
    {
        return $this->status;
    }

    public function isDraft(): bool
    {
        return $this->status === ExchangeStatus::Draft;
    }

    public function isConfirmed(): bool
    {
        return $this->status === ExchangeStatus::Confirmed;
    }

    public function isCompleted(): bool
    {
        return $this->status === ExchangeStatus::Completed;
    }

    public function isCancelled(): bool
    {
        return $this->status === ExchangeStatus::Cancelled;
    }

    public function pullDomainEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];

        return $events;
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * @param  ExchangeLine[]  $lines
     */
    private static function sumLines(array $lines, string $currency): Money
    {
        $total = Money::zero($currency);
        foreach ($lines as $line) {
            $total = $total->add($line->lineTotal);
        }

        return $total;
    }

    private static function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
