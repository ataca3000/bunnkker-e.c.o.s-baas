<?php

declare(strict_types=1);

namespace Modules\POS\Cart\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use Modules\POS\Cart\Domain\Events\CartCancelled;
use Modules\POS\Cart\Domain\Events\CartCompleted;
use Modules\POS\Cart\Domain\Events\CartExpired;
use Modules\POS\Cart\Domain\Events\CartHeld;
use Modules\POS\Cart\Domain\Events\CartLineAdded;
use Modules\POS\Cart\Domain\Events\CartLineRemoved;
use Modules\POS\Cart\Domain\Events\CartOpened;
use Modules\POS\Cart\Domain\Events\CartResumed;
use Modules\POS\Cart\Domain\Exceptions\InvalidCartTransitionException;
use Modules\POS\Cart\Domain\ValueObjects\CartLine;
use Modules\POS\Cart\Domain\ValueObjects\ReceiptNumber;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\Enums\CartStatus;
use Modules\POS\Shared\Domain\Enums\DiscountType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;

/**
 * Cart Aggregate Root — the central transactional unit of the POS.
 *
 * State machine:
 *
 *   Active ──addLine/updateLine/removeLine──▶ Active
 *   Active ──hold()──▶ Held ──resume()──▶ Active
 *   Held   ──expire()──▶ Expired         (terminal)
 *   Active ──initiatePayment()──▶ Paying
 *   Paying ──cancelPayment()──▶ Active   (ADR-POS-010: back-transition)
 *   Paying ──complete()──▶ Completed     (terminal)
 *   Active ──cancel()──▶ Cancelled       (terminal)
 *
 * Lines are stored as JSONB and managed exclusively through this aggregate.
 * All Money amounts are stored as JSONB {amount, currency} pairs.
 */
final class Cart extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'pos_carts';

    private array $domainEvents = [];

    protected $fillable = [
        'session_id', 'shift_id', 'terminal_id', 'cashier_id', 'customer_id',
        'status', 'currency', 'lines', 'subtotal', 'discount_total', 'total',
        'order_discount_type', 'order_discount_value', 'receipt_number', 'notes',
        'held_at', 'completed_at', 'cancelled_at', 'expired_at', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'status' => CartStatus::class,
            'lines' => 'array',
            'subtotal' => 'array',
            'discount_total' => 'array',
            'total' => 'array',
            'metadata' => 'array',
            'held_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'expired_at' => 'datetime',
        ];
    }

    // ── Domain event collection ────────────────────────────────────────────────

    public function addEvent(DomainEvent $event): void
    {
        $this->domainEvents[] = $event;
    }

    /** Pull and clear all accumulated domain events. Call after save(). */
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

    // ── Factory ────────────────────────────────────────────────────────────────

    public static function open(
        string $sessionId,
        string $shiftId,
        string $terminalId,
        string $cashierId,
        string $currency,
        ?string $customerId = null,
    ): self {
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

        $currency = strtoupper(trim($currency));
        if ($currency === '') {
            throw new InvalidArgumentException('Currency cannot be empty.');
        }

        $zero = Money::zero($currency)->toArray();

        $cart = new self;
        $cart->id = self::generateUuid();
        $cart->session_id = $sessionId;
        $cart->shift_id = $shiftId;
        $cart->terminal_id = $terminalId;
        $cart->cashier_id = $cashierId;
        $cart->customer_id = $customerId;
        $cart->status = CartStatus::Active;
        $cart->currency = $currency;
        $cart->lines = [];
        $cart->subtotal = $zero;
        $cart->discount_total = $zero;
        $cart->total = $zero;

        $cart->addEvent(CartOpened::now(
            cartId: $cart->id,
            sessionId: $sessionId,
            shiftId: $shiftId,
            terminalId: $terminalId,
            cashierId: $cashierId,
            customerId: $customerId,
            currency: $currency,
        ));

        return $cart;
    }

    // ── Line management ────────────────────────────────────────────────────────

    /**
     * Add a product to the cart. Returns the new line's UUID.
     *
     * Only allowed from Active state; currency must match the cart's currency.
     */
    public function addLine(
        string $productId,
        string $productName,
        string $sku,
        Quantity $quantity,
        Money $unitPrice,
        ?DiscountType $discountType = null,
        ?string $discountValue = null,
    ): string {
        $this->guardActive();
        $this->guardSameCurrency($unitPrice);

        if (! $quantity->isPositive()) {
            throw new InvalidArgumentException('Line quantity must be positive.');
        }

        $sortOrder = count($this->lines ?? []);
        $line = CartLine::create(
            $productId, $productName, $sku, $quantity, $unitPrice,
            $discountType, $discountValue, $sortOrder,
        );

        $lines = $this->getLines();
        $lines[] = $line;
        $this->setLines($lines);
        $this->recalculateTotals();

        $this->addEvent(CartLineAdded::now(
            cartId: (string) $this->id,
            lineId: $line->id,
            productId: $productId,
            productName: $productName,
            sku: $sku,
            quantity: $quantity->value,
            unitPriceAmount: $unitPrice->amount,
            lineTotalAmount: $line->lineTotal->amount,
            currency: $unitPrice->currency,
        ));

        return $line->id;
    }

    /** Update the quantity of an existing line; recalculates line total and cart totals. */
    public function updateLine(string $lineId, Quantity $quantity): void
    {
        $this->guardActive();

        if (! $quantity->isPositive()) {
            throw new InvalidArgumentException('Line quantity must be positive.');
        }

        $lines = $this->getLines();
        $found = false;

        foreach ($lines as $i => $line) {
            if ($line->id === $lineId) {
                $lines[$i] = $line->withQuantity($quantity);
                $found = true;
                break;
            }
        }

        if (! $found) {
            throw InvalidCartTransitionException::lineNotFound($this->id ?? '', $lineId);
        }

        $this->setLines($lines);
        $this->recalculateTotals();
    }

    /** Remove a line from the cart; recalculates cart totals. */
    public function removeLine(string $lineId): void
    {
        $this->guardActive();

        $lines = $this->getLines();
        $filtered = array_values(array_filter($lines, fn (CartLine $l) => $l->id !== $lineId));

        if (count($filtered) === count($lines)) {
            throw InvalidCartTransitionException::lineNotFound($this->id ?? '', $lineId);
        }

        $removedLine = current(array_filter($lines, fn (CartLine $l) => $l->id === $lineId));

        $this->setLines($filtered);
        $this->recalculateTotals();

        $this->addEvent(CartLineRemoved::now(
            cartId: (string) $this->id,
            lineId: $lineId,
            productId: $removedLine ? $removedLine->productId : '',
        ));
    }

    /** Apply an order-level discount; recalculates the cart total. Only allowed from Active. */
    public function applyOrderDiscount(DiscountType $type, string $value): void
    {
        $this->guardActive();

        $this->order_discount_type = $type->value;
        $this->order_discount_value = $value;
        $this->recalculateTotals();
    }

    /** Remove any previously applied order-level discount. */
    public function removeOrderDiscount(): void
    {
        $this->guardActive();

        $this->order_discount_type = null;
        $this->order_discount_value = null;
        $this->recalculateTotals();
    }

    // ── State machine ──────────────────────────────────────────────────────────

    /** Park the cart so the cashier can serve another customer. Active → Held. */
    public function hold(): void
    {
        if ($this->status !== CartStatus::Active) {
            throw InvalidCartTransitionException::cannotTransition(
                $this->id ?? '', $this->status, CartStatus::Held,
            );
        }

        $this->status = CartStatus::Held;
        $this->held_at = now();

        $this->addEvent(CartHeld::now(
            cartId: (string) $this->id,
            sessionId: (string) $this->session_id,
            terminalId: (string) $this->terminal_id,
            cashierId: (string) $this->cashier_id,
            lineCount: $this->getLineCount(),
            totalAmount: $this->getTotal()->amount,
            currency: $this->currency,
        ));
    }

    /** Resume a previously held cart. Held → Active. */
    public function resume(): void
    {
        if ($this->status !== CartStatus::Held) {
            throw InvalidCartTransitionException::cannotTransition(
                $this->id ?? '', $this->status, CartStatus::Active,
            );
        }

        $this->status = CartStatus::Active;
        $this->held_at = null;

        $this->addEvent(CartResumed::now(
            cartId: (string) $this->id,
            sessionId: (string) $this->session_id,
            terminalId: (string) $this->terminal_id,
            cashierId: (string) $this->cashier_id,
        ));
    }

    /**
     * Mark a held cart as expired (e.g. held_expiry_hours from config/pos.php).
     * Held → Expired (terminal state).
     */
    public function expire(): void
    {
        if ($this->status !== CartStatus::Held) {
            throw InvalidCartTransitionException::cannotTransition(
                $this->id ?? '', $this->status, CartStatus::Expired,
            );
        }

        $this->status = CartStatus::Expired;
        $this->expired_at = now();

        $this->addEvent(CartExpired::now(
            cartId: (string) $this->id,
            sessionId: (string) $this->session_id,
            terminalId: (string) $this->terminal_id,
        ));
    }

    /**
     * Move the cart to the payment screen. Active → Paying.
     * Cart must have at least one line.
     */
    public function initiatePayment(): void
    {
        if ($this->status !== CartStatus::Active) {
            throw InvalidCartTransitionException::cannotTransition(
                $this->id ?? '', $this->status, CartStatus::Paying,
            );
        }
        if (! $this->hasLines()) {
            throw InvalidCartTransitionException::cartIsEmpty($this->id ?? '');
        }

        $this->status = CartStatus::Paying;
    }

    /**
     * Cancel the payment screen and return to cart editing. Paying → Active.
     * ADR-POS-010: back-transition is allowed when no payment has been captured.
     */
    public function cancelPayment(): void
    {
        if ($this->status !== CartStatus::Paying) {
            throw InvalidCartTransitionException::cannotTransition(
                $this->id ?? '', $this->status, CartStatus::Active,
            );
        }

        $this->status = CartStatus::Active;
    }

    /**
     * Finalise the sale. Paying → Completed (terminal state).
     * Requires a ReceiptNumber generated by the application layer.
     */
    public function complete(ReceiptNumber $receiptNumber): void
    {
        if ($this->status !== CartStatus::Paying) {
            throw InvalidCartTransitionException::cannotTransition(
                $this->id ?? '', $this->status, CartStatus::Completed,
            );
        }

        $this->status = CartStatus::Completed;
        $this->receipt_number = $receiptNumber->value;
        $this->completed_at = now();

        $this->addEvent(CartCompleted::now(
            cartId: (string) $this->id,
            sessionId: (string) $this->session_id,
            terminalId: (string) $this->terminal_id,
            cashierId: (string) $this->cashier_id,
            receiptNumber: $receiptNumber->value,
            totalAmount: $this->getTotal()->amount,
            currency: $this->currency,
            lineCount: $this->getLineCount(),
        ));
    }

    /**
     * Abandon the cart. Allowed from Active or Held.
     * Cannot cancel a Paying or terminal cart.
     */
    public function cancel(): void
    {
        if ($this->status->isTerminal()) {
            throw InvalidCartTransitionException::terminalState($this->id ?? '', $this->status);
        }
        if ($this->status === CartStatus::Paying) {
            throw InvalidCartTransitionException::cannotTransition(
                $this->id ?? '', $this->status, CartStatus::Cancelled,
            );
        }

        $this->status = CartStatus::Cancelled;
        $this->cancelled_at = now();

        $this->addEvent(CartCancelled::now(
            cartId: (string) $this->id,
            sessionId: (string) $this->session_id,
            terminalId: (string) $this->terminal_id,
            cashierId: (string) $this->cashier_id,
        ));
    }

    // ── Getters ────────────────────────────────────────────────────────────────

    /** @return CartLine[] */
    public function getLines(): array
    {
        return array_map(
            fn (array $d) => CartLine::fromArray($d),
            $this->lines ?? [],
        );
    }

    public function getSubtotal(): Money
    {
        return Money::fromArray($this->subtotal);
    }

    public function getDiscountTotal(): Money
    {
        return Money::fromArray($this->discount_total);
    }

    public function getTotal(): Money
    {
        return Money::fromArray($this->total);
    }

    public function getReceiptNumber(): ?ReceiptNumber
    {
        return $this->receipt_number !== null
            ? ReceiptNumber::of($this->receipt_number)
            : null;
    }

    public function getLineCount(): int
    {
        return count($this->lines ?? []);
    }

    public function hasLines(): bool
    {
        return $this->getLineCount() > 0;
    }

    public function isActive(): bool
    {
        return $this->status === CartStatus::Active;
    }

    public function isHeld(): bool
    {
        return $this->status === CartStatus::Held;
    }

    public function isPaying(): bool
    {
        return $this->status === CartStatus::Paying;
    }

    public function isCompleted(): bool
    {
        return $this->status === CartStatus::Completed;
    }

    public function isCancelled(): bool
    {
        return $this->status === CartStatus::Cancelled;
    }

    public function isExpired(): bool
    {
        return $this->status === CartStatus::Expired;
    }

    public function canAddItems(): bool
    {
        return $this->status->canAddItems();
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private function setLines(array $cartLines): void
    {
        $this->lines = array_values(
            array_map(fn (CartLine $l) => $l->toArray(), $cartLines),
        );
    }

    /**
     * subtotal       = sum of all line totals (after per-line discounts)
     * discount_total = order-level discount applied to subtotal
     * total          = subtotal − discount_total
     */
    private function recalculateTotals(): void
    {
        $subtotal = Money::zero($this->currency);

        foreach ($this->getLines() as $line) {
            $subtotal = $subtotal->add($line->lineTotal);
        }

        $discountTotal = Money::zero($this->currency);

        if ($this->order_discount_type !== null && $this->order_discount_value !== null) {
            $type = DiscountType::from($this->order_discount_type);
            $discountTotal = $type->computeAmount($subtotal, $this->order_discount_value);
        }

        $this->subtotal = $subtotal->toArray();
        $this->discount_total = $discountTotal->toArray();
        $this->total = $subtotal->subtract($discountTotal)->toArray();
    }

    private function guardActive(): void
    {
        if ($this->status->isTerminal()) {
            throw InvalidCartTransitionException::terminalState($this->id ?? '', $this->status);
        }
        if ($this->status !== CartStatus::Active) {
            throw InvalidCartTransitionException::cannotTransition(
                $this->id ?? '', $this->status, CartStatus::Active,
            );
        }
    }

    private function guardSameCurrency(Money $money): void
    {
        if ($money->currency !== $this->currency) {
            throw new InvalidArgumentException(
                "Currency mismatch: cart uses \"{$this->currency}\" but received \"{$money->currency}\".",
            );
        }
    }
}
