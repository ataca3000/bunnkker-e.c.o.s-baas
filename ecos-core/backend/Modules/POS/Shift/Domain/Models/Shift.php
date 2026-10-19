<?php

declare(strict_types=1);

namespace Modules\POS\Shift\Domain\Models;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\Enums\ShiftStatus;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;
use Modules\POS\Shift\Domain\Events\ShiftApproved;
use Modules\POS\Shift\Domain\Events\ShiftCountRejected;
use Modules\POS\Shift\Domain\Events\ShiftOpened;
use Modules\POS\Shift\Domain\Events\ShiftSubmittedForClosure;
use Modules\POS\Shift\Domain\Exceptions\InvalidShiftTransitionException;
use Modules\POS\Shift\Domain\ValueObjects\ShiftNumber;

final class Shift extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'pos_shifts';

    private array $domainEvents = [];

    protected $fillable = [
        'shift_number',
        'session_id',
        'terminal_id',
        'cashier_id',
        'status',
        'opening_cash',
        'closing_count',
        'expected_closing',
        'variance',
        'rejection_reason',
        'opened_at',
        'submitted_at',
        'closed_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'status' => ShiftStatus::class,
            'shift_number' => 'integer',
            'opening_cash' => 'array',
            'closing_count' => 'array',
            'expected_closing' => 'array',
            'variance' => 'array',
            'metadata' => 'array',
            'opened_at' => 'datetime',
            'submitted_at' => 'datetime',
            'closed_at' => 'datetime',
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

    /**
     * Opens a new shift for a cashier session on the given terminal.
     *
     * The shift_number must be unique per terminal and is assigned by the
     * repository before calling this factory (countByTerminal() + 1).
     * The returned shift is NOT persisted — call $repository->save() after.
     */
    public static function open(
        string $sessionId,
        string $terminalId,
        string $cashierId,
        Money $openingCash,
        ShiftNumber $shiftNumber,
    ): self {
        if (trim($sessionId) === '') {
            throw new InvalidArgumentException('Session ID cannot be empty.');
        }
        if (trim($terminalId) === '') {
            throw new InvalidArgumentException('Terminal ID cannot be empty.');
        }
        if (trim($cashierId) === '') {
            throw new InvalidArgumentException('Cashier ID cannot be empty.');
        }

        $shift = new self;
        $shift->id = self::generateUuid();
        $shift->session_id = $sessionId;
        $shift->terminal_id = $terminalId;
        $shift->cashier_id = $cashierId;
        $shift->shift_number = $shiftNumber->value;
        $shift->status = ShiftStatus::Open;
        $shift->opening_cash = $openingCash->toArray();
        $shift->opened_at = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

        $shift->addEvent(ShiftOpened::now(
            shiftId: $shift->id,
            sessionId: $sessionId,
            terminalId: $terminalId,
            cashierId: $cashierId,
            shiftNumber: $shiftNumber->value,
            openingCashAmount: $openingCash->amount,
            currency: $openingCash->currency,
        ));

        return $shift;
    }

    /**
     * Submits the cashier's cash count to begin the closing process.
     * Allowed from Open (initial submission) or Closing (resubmission after rejection).
     * Per ADR-POS-006, rejection returns to Closing so the cashier resubmits here.
     */
    public function submitForClosure(Money $closingCount): void
    {
        if (! in_array($this->status, [ShiftStatus::Open, ShiftStatus::Closing], true)) {
            throw InvalidShiftTransitionException::cannotTransition(
                (string) $this->id,
                $this->status,
                ShiftStatus::Closing,
            );
        }

        $this->guardSameCurrency($closingCount);

        $this->status = ShiftStatus::Closing;
        $this->closing_count = $closingCount->toArray();
        $this->submitted_at = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
        $this->rejection_reason = null;

        $this->addEvent(ShiftSubmittedForClosure::now(
            shiftId: (string) $this->id,
            sessionId: (string) $this->session_id,
            terminalId: (string) $this->terminal_id,
            cashierId: (string) $this->cashier_id,
            shiftNumber: (int) $this->shift_number,
            closingCountAmount: $closingCount->amount,
            currency: $closingCount->currency,
        ));
    }

    /**
     * Supervisor approves the closing count and finalises the shift.
     * Calculates variance = closing_count − expected_closing.
     * A positive variance means the cashier has more than expected (over).
     * A negative variance means the cashier has less than expected (short).
     */
    public function approve(Money $expectedClosing): void
    {
        if ($this->status !== ShiftStatus::Closing) {
            throw InvalidShiftTransitionException::cannotTransition(
                (string) $this->id,
                $this->status,
                ShiftStatus::Closed,
            );
        }

        if ($this->closing_count === null) {
            throw InvalidShiftTransitionException::noClosingCount((string) $this->id);
        }

        $this->guardSameCurrency($expectedClosing);

        $closingCount = Money::fromArray($this->closing_count);
        $variance = $closingCount->subtract($expectedClosing);

        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $openedAt = $this->opened_at instanceof DateTimeInterface
            ? DateTimeImmutable::createFromInterface($this->opened_at)
            : new DateTimeImmutable((string) $this->opened_at, new DateTimeZone('UTC'));
        $durationMinutes = (int) max(0, (int) ceil(($now->getTimestamp() - $openedAt->getTimestamp()) / 60));

        $this->status = ShiftStatus::Closed;
        $this->expected_closing = $expectedClosing->toArray();
        $this->variance = $variance->toArray();
        $this->closed_at = $now->format('Y-m-d H:i:s');

        $this->addEvent(ShiftApproved::now(
            shiftId: (string) $this->id,
            sessionId: (string) $this->session_id,
            terminalId: (string) $this->terminal_id,
            cashierId: (string) $this->cashier_id,
            shiftNumber: (int) $this->shift_number,
            closingCountAmount: $closingCount->amount,
            expectedClosingAmount: $expectedClosing->amount,
            varianceAmount: $variance->amount,
            currency: $expectedClosing->currency,
            durationMinutes: $durationMinutes,
        ));
    }

    /**
     * Supervisor rejects the cashier's closing count.
     * Per ADR-POS-006: the shift stays in Closing state (no terminal Rejected state).
     * The closing count is cleared so the cashier must recount and resubmit.
     */
    public function rejectCount(string $reason = ''): void
    {
        if ($this->status !== ShiftStatus::Closing) {
            throw InvalidShiftTransitionException::cannotTransition(
                (string) $this->id,
                $this->status,
                ShiftStatus::Closing,
            );
        }

        if ($this->closing_count === null) {
            throw InvalidShiftTransitionException::noClosingCount((string) $this->id);
        }

        $this->closing_count = null;
        $this->submitted_at = null;
        $this->rejection_reason = trim($reason);

        $this->addEvent(ShiftCountRejected::now(
            shiftId: (string) $this->id,
            sessionId: (string) $this->session_id,
            terminalId: (string) $this->terminal_id,
            cashierId: (string) $this->cashier_id,
            shiftNumber: (int) $this->shift_number,
            reason: trim($reason),
        ));
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    public function getShiftNumber(): ShiftNumber
    {
        return ShiftNumber::of($this->shift_number);
    }

    public function getOpeningCash(): Money
    {
        return Money::fromArray($this->opening_cash);
    }

    public function getClosingCount(): ?Money
    {
        return $this->closing_count !== null ? Money::fromArray($this->closing_count) : null;
    }

    public function getExpectedClosing(): ?Money
    {
        return $this->expected_closing !== null ? Money::fromArray($this->expected_closing) : null;
    }

    public function getVariance(): ?Money
    {
        return $this->variance !== null ? Money::fromArray($this->variance) : null;
    }

    // ── Status helpers ────────────────────────────────────────────────────────

    public function isOpen(): bool
    {
        return $this->status === ShiftStatus::Open;
    }

    public function isInClosing(): bool
    {
        return $this->status === ShiftStatus::Closing;
    }

    public function isClosed(): bool
    {
        return $this->status === ShiftStatus::Closed;
    }

    /** True when sales transactions can be attached to this shift. */
    public function canProcessSales(): bool
    {
        return $this->status->canProcessSales();
    }

    /** True when a closing count has been submitted and is awaiting supervisor decision. */
    public function hasPendingCount(): bool
    {
        return $this->status === ShiftStatus::Closing && $this->closing_count !== null;
    }

    /**
     * Returns true when the absolute cash variance is within the supplied tolerance.
     * Tolerance is expressed as a percentage of the opening cash (e.g. 5% for 5%).
     * If the opening cash is zero, only a zero variance is considered within tolerance.
     */
    public function isVarianceWithinTolerance(Percentage $tolerance): bool
    {
        if ($this->variance === null) {
            return false;
        }

        $absoluteVariance = Money::fromArray($this->variance)->absolute();
        $openingCash = Money::fromArray($this->opening_cash)->absolute();

        if ($openingCash->isZero()) {
            return $absoluteVariance->isZero();
        }

        $threshold = $tolerance->applyTo($openingCash);

        return $absoluteVariance->isLessThanOrEqual($threshold);
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private function guardSameCurrency(Money $money): void
    {
        $expected = $this->opening_cash['currency'] ?? '';

        if ($money->currency !== $expected) {
            throw InvalidShiftTransitionException::currencyMismatch(
                (string) $this->id,
                $expected,
                $money->currency,
            );
        }
    }
}
