<?php

declare(strict_types=1);

namespace Modules\POS\Payment\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use Modules\POS\Payment\Domain\Enums\PaymentStatus;
use Modules\POS\Payment\Domain\Events\PaymentCaptured;
use Modules\POS\Payment\Domain\Events\PaymentInitiated;
use Modules\POS\Payment\Domain\Events\TenderAdded;
use Modules\POS\Payment\Domain\Events\TenderRemoved;
use Modules\POS\Payment\Domain\Exceptions\InsufficientPaymentException;
use Modules\POS\Payment\Domain\Exceptions\InvalidPaymentStateException;
use Modules\POS\Payment\Domain\ValueObjects\PaymentTender;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final class Payment extends Model
{
    use HasUuids;

    protected $table = 'pos_payments';

    protected $guarded = [];

    private array $domainEvents = [];

    protected function casts(): array
    {
        return [
            'status' => PaymentStatus::class,
            'cart_total' => 'array',
            'tenders' => 'array',
            'amount_tendered' => 'array',
            'change_due' => 'array',
            'metadata' => 'array',
            'captured_at' => 'datetime',
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

    public static function initiate(
        string $cartId,
        string $sessionId,
        string $shiftId,
        string $terminalId,
        string $cashierId,
        Money $cartTotal,
    ): self {
        if (trim($cartId) === '') {
            throw new InvalidArgumentException('Cart ID cannot be empty.');
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

        $currency = $cartTotal->currency;

        $payment = new self;
        $payment->id = self::generateUuid();
        $payment->cart_id = $cartId;
        $payment->session_id = $sessionId;
        $payment->shift_id = $shiftId;
        $payment->terminal_id = $terminalId;
        $payment->cashier_id = $cashierId;
        $payment->status = PaymentStatus::Pending;
        $payment->currency = $currency;
        $payment->cart_total = $cartTotal->toArray();
        $payment->tenders = [];
        $payment->amount_tendered = Money::zero($currency)->toArray();
        $payment->change_due = Money::zero($currency)->subtract($cartTotal)->toArray();

        $payment->addEvent(PaymentInitiated::now(
            paymentId: $payment->id,
            cartId: $cartId,
            sessionId: $sessionId,
            shiftId: $shiftId,
            terminalId: $terminalId,
            cashierId: $cashierId,
            cartTotalAmount: $cartTotal->amount,
            currency: $currency,
        ));

        return $payment;
    }

    // ── Tender Management ─────────────────────────────────────────────────────

    public function addTender(
        PaymentMethodType $type,
        Money $amount,
        ?string $reference = null,
        array $metadata = [],
    ): string {
        $this->guardPending();
        $this->guardSameCurrency($amount);

        $tender = PaymentTender::create($type, $amount, $reference, $metadata);
        $tenders = $this->getTenders();
        $tenders[] = $tender;
        $this->setTenders($tenders);
        $this->recalculateAmounts();

        $this->addEvent(TenderAdded::now(
            paymentId: (string) $this->id,
            cartId: (string) $this->cart_id,
            tenderId: $tender->id,
            type: $type->value,
            tenderAmount: $amount->amount,
            currency: $amount->currency,
            reference: $reference,
            amountTenderedTotal: $this->getAmountTendered()->amount,
        ));

        return $tender->id;
    }

    public function removeTender(string $tenderId): void
    {
        $this->guardPending();

        $tenders = $this->getTenders();
        $filtered = array_values(
            array_filter($tenders, fn (PaymentTender $t) => $t->id !== $tenderId),
        );

        if (count($filtered) === count($tenders)) {
            throw InvalidPaymentStateException::tenderNotFound($this->id ?? '', $tenderId);
        }

        $removed = null;
        foreach ($tenders as $t) {
            if ($t->id === $tenderId) {
                $removed = $t;
                break;
            }
        }

        $this->setTenders($filtered);
        $this->recalculateAmounts();

        $this->addEvent(TenderRemoved::now(
            paymentId: (string) $this->id,
            cartId: (string) $this->cart_id,
            tenderId: $tenderId,
            type: $removed->type->value,
            amountTenderedTotal: $this->getAmountTendered()->amount,
        ));
    }

    // ── State Transition ──────────────────────────────────────────────────────

    public function capture(): void
    {
        if ($this->status !== PaymentStatus::Pending) {
            throw InvalidPaymentStateException::alreadyCaptured($this->id ?? '');
        }

        if (! $this->isFullyPaid()) {
            throw InsufficientPaymentException::forCapture(
                $this->id ?? '',
                $this->getCartTotal(),
                $this->getAmountTendered(),
            );
        }

        $this->status = PaymentStatus::Captured;
        $this->captured_at = now();

        $this->addEvent(PaymentCaptured::now(
            paymentId: (string) $this->id,
            cartId: (string) $this->cart_id,
            sessionId: (string) $this->session_id,
            terminalId: (string) $this->terminal_id,
            cashierId: (string) $this->cashier_id,
            cartTotalAmount: $this->getCartTotal()->amount,
            amountTenderedAmount: $this->getAmountTendered()->amount,
            changeDueAmount: $this->getChangeDue()->amount,
            currency: (string) $this->currency,
            tenderCount: $this->getTenderCount(),
        ));
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    /** @return PaymentTender[] */
    public function getTenders(): array
    {
        return array_map(
            fn (array $d) => PaymentTender::fromArray($d),
            $this->tenders ?? [],
        );
    }

    public function getCartTotal(): Money
    {
        return Money::fromArray($this->cart_total);
    }

    public function getAmountTendered(): Money
    {
        return Money::fromArray($this->amount_tendered);
    }

    public function getChangeDue(): Money
    {
        return Money::fromArray($this->change_due);
    }

    public function getRemainingBalance(): Money
    {
        return $this->getCartTotal()->subtract($this->getAmountTendered());
    }

    public function isFullyPaid(): bool
    {
        return $this->getAmountTendered()->isGreaterThanOrEqual($this->getCartTotal());
    }

    public function getTenderCount(): int
    {
        return count($this->tenders ?? []);
    }

    public function hasTenders(): bool
    {
        return $this->getTenderCount() > 0;
    }

    public function isPending(): bool
    {
        return $this->status === PaymentStatus::Pending;
    }

    public function isCaptured(): bool
    {
        return $this->status === PaymentStatus::Captured;
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private function setTenders(array $paymentTenders): void
    {
        $this->tenders = array_values(
            array_map(fn (PaymentTender $t) => $t->toArray(), $paymentTenders),
        );
    }

    private function recalculateAmounts(): void
    {
        $tendered = Money::zero($this->currency);
        $cartTotal = $this->getCartTotal();

        foreach ($this->getTenders() as $tender) {
            $tendered = $tendered->add($tender->amount);
        }

        $this->amount_tendered = $tendered->toArray();
        $this->change_due = $tendered->subtract($cartTotal)->toArray();
    }

    private function guardPending(): void
    {
        if ($this->status !== PaymentStatus::Pending) {
            throw InvalidPaymentStateException::cannotModifyTenders($this->id ?? '', $this->status);
        }
    }

    private function guardSameCurrency(Money $money): void
    {
        if ($money->currency !== $this->currency) {
            throw new InvalidArgumentException(
                "Currency mismatch: payment uses \"{$this->currency}\" but received \"{$money->currency}\".",
            );
        }
    }
}
