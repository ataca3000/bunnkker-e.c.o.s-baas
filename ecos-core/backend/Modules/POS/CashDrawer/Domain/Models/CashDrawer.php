<?php

declare(strict_types=1);

namespace Modules\POS\CashDrawer\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use Modules\POS\CashDrawer\Domain\Events\CashInRecorded;
use Modules\POS\CashDrawer\Domain\Events\CashOutRecorded;
use Modules\POS\CashDrawer\Domain\Events\ClosingCountRecorded;
use Modules\POS\CashDrawer\Domain\Events\DrawerClosed;
use Modules\POS\CashDrawer\Domain\Events\DrawerOpened;
use Modules\POS\CashDrawer\Domain\Exceptions\InvalidDrawerOperationException;
use Modules\POS\CashDrawer\Domain\ValueObjects\CashMovement;
use Modules\POS\Shared\Domain\Enums\CashDrawerStatus;
use Modules\POS\Shared\Domain\Enums\TransactionType;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final class CashDrawer extends Model
{
    use HasUuids;

    protected $table = 'pos_cash_drawers';

    protected $guarded = [];

    protected $casts = [
        'movements' => 'array',
        'opening_float' => 'array',
        'closing_count' => 'array',
    ];

    // ── Factory ──────────────────────────────────────────────────────────────

    public static function open(
        string $terminalId,
        string $sessionId,
        string $shiftId,
        string $cashierId,
        string $currency,
        Money $openingFloat,
    ): self {
        if (trim($terminalId) === '') {
            throw new InvalidArgumentException('Terminal ID cannot be empty.');
        }
        if (trim($sessionId) === '') {
            throw new InvalidArgumentException('Session ID cannot be empty.');
        }
        if (trim($shiftId) === '') {
            throw new InvalidArgumentException('Shift ID cannot be empty.');
        }
        if (trim($cashierId) === '') {
            throw new InvalidArgumentException('Cashier ID cannot be empty.');
        }
        if (trim($currency) === '') {
            throw new InvalidArgumentException('Currency cannot be empty.');
        }
        if ($openingFloat->isNegative()) {
            throw new InvalidArgumentException('Opening float cannot be negative.');
        }

        $drawer = new self;
        $drawer->terminal_id = $terminalId;
        $drawer->session_id = $sessionId;
        $drawer->shift_id = $shiftId;
        $drawer->cashier_id = $cashierId;
        $drawer->currency = $currency;
        $drawer->status = CashDrawerStatus::Open->value;
        $drawer->opening_float = $openingFloat->toArray();
        $drawer->movements = [];
        $drawer->closing_count = null;
        $drawer->opened_at = now();
        $drawer->closed_at = null;

        $drawer->dispatchDomainEvent(DrawerOpened::now(
            drawerId: $drawer->id ?? '',
            terminalId: $terminalId,
            sessionId: $sessionId,
            shiftId: $shiftId,
            cashierId: $cashierId,
            currency: $currency,
            openingFloat: $openingFloat->amount,
        ));

        return $drawer;
    }

    // ── Behavior ─────────────────────────────────────────────────────────────

    public function recordCashIn(Money $amount, ?string $note = null): string
    {
        $this->guardOpen();
        $this->guardSameCurrency($amount);

        $movement = CashMovement::record(TransactionType::CashIn, $amount, $note);
        $movements = $this->movements ?? [];
        $movements[] = $movement->toArray();
        $this->movements = $movements;

        $this->dispatchDomainEvent(CashInRecorded::now(
            drawerId: (string) $this->id,
            movementId: $movement->id,
            shiftId: (string) $this->shift_id,
            amount: $amount->amount,
            currency: $amount->currency,
            note: $note,
        ));

        return $movement->id;
    }

    public function recordCashOut(Money $amount, ?string $note = null): string
    {
        $this->guardOpen();
        $this->guardSameCurrency($amount);

        $movement = CashMovement::record(TransactionType::CashOut, $amount, $note);
        $movements = $this->movements ?? [];
        $movements[] = $movement->toArray();
        $this->movements = $movements;

        $this->dispatchDomainEvent(CashOutRecorded::now(
            drawerId: (string) $this->id,
            movementId: $movement->id,
            shiftId: (string) $this->shift_id,
            amount: $amount->amount,
            currency: $amount->currency,
            note: $note,
        ));

        return $movement->id;
    }

    public function recordClosingCount(Money $actualCount): void
    {
        $this->guardOpen();
        $this->guardSameCurrency($actualCount);

        if ($actualCount->isNegative()) {
            throw new InvalidArgumentException('Closing count cannot be negative.');
        }

        if ($this->closing_count !== null) {
            throw InvalidDrawerOperationException::closingCountAlreadyRecorded((string) $this->id);
        }

        $this->closing_count = $actualCount->toArray();

        $this->dispatchDomainEvent(ClosingCountRecorded::now(
            drawerId: (string) $this->id,
            shiftId: (string) $this->shift_id,
            actualCount: $actualCount->amount,
            currency: $actualCount->currency,
        ));
    }

    public function close(): void
    {
        $this->guardOpen();

        if ($this->closing_count === null) {
            throw InvalidDrawerOperationException::closingCountRequired((string) $this->id);
        }

        $expected = $this->getExpectedBalance();
        $closing = $this->getClosingCount();
        $variance = $this->getVariance();

        $this->status = CashDrawerStatus::Closed->value;
        $this->closed_at = now();

        $this->dispatchDomainEvent(DrawerClosed::now(
            drawerId: (string) $this->id,
            shiftId: (string) $this->shift_id,
            terminalId: (string) $this->terminal_id,
            openingFloat: $this->getOpeningFloat()->amount,
            expectedBalance: $expected->amount,
            closingCount: $closing->amount,
            variance: $variance->amount,
            currency: $this->currency,
        ));
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    public function getOpeningFloat(): Money
    {
        return Money::fromArray($this->opening_float);
    }

    public function getClosingCount(): Money
    {
        if ($this->closing_count === null) {
            return Money::zero($this->currency);
        }

        return Money::fromArray($this->closing_count);
    }

    public function getExpectedBalance(): Money
    {
        $balance = $this->getOpeningFloat();

        foreach ($this->movements ?? [] as $data) {
            $movement = CashMovement::fromArray($data);
            if ($movement->type === TransactionType::CashIn) {
                $balance = $balance->add($movement->amount);
            } elseif ($movement->type === TransactionType::CashOut) {
                $balance = $balance->subtract($movement->amount);
            }
        }

        return $balance;
    }

    public function getVariance(): Money
    {
        if ($this->closing_count === null) {
            return Money::zero($this->currency);
        }

        return $this->getClosingCount()->subtract($this->getExpectedBalance());
    }

    public function isOverage(): bool
    {
        return $this->closing_count !== null && $this->getVariance()->isPositive();
    }

    public function isShort(): bool
    {
        return $this->closing_count !== null && $this->getVariance()->isNegative();
    }

    public function isBalanced(): bool
    {
        return $this->closing_count !== null && $this->getVariance()->isZero();
    }

    public function getMovements(): array
    {
        return array_map(
            fn (array $data) => CashMovement::fromArray($data),
            $this->movements ?? [],
        );
    }

    public function getMovementCount(): int
    {
        return count($this->movements ?? []);
    }

    public function getStatus(): CashDrawerStatus
    {
        return CashDrawerStatus::from($this->status);
    }

    public function isOpen(): bool
    {
        return $this->getStatus() === CashDrawerStatus::Open;
    }

    public function isClosed(): bool
    {
        return $this->getStatus() === CashDrawerStatus::Closed;
    }

    // ── Guards ────────────────────────────────────────────────────────────────

    private function guardOpen(): void
    {
        if (! $this->isOpen()) {
            throw InvalidDrawerOperationException::drawerAlreadyClosed((string) $this->id);
        }
    }

    private function guardSameCurrency(Money $money): void
    {
        if ($money->currency !== $this->currency) {
            throw new InvalidArgumentException(
                "Currency mismatch: drawer is {$this->currency}, got {$money->currency}.",
            );
        }
    }

    // ── Domain Events (deferred dispatch) ────────────────────────────────────

    /** @var array<object> */
    private array $domainEvents = [];

    private function dispatchDomainEvent(object $event): void
    {
        $this->domainEvents[] = $event;
    }

    public function pullDomainEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];

        return $events;
    }
}
