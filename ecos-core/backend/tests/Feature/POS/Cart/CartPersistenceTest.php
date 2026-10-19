<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Cart;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Cart\Domain\Contracts\CartRepositoryInterface;
use Modules\POS\Cart\Domain\Models\Cart;
use Modules\POS\Cart\Domain\ValueObjects\ReceiptNumber;
use Modules\POS\Shared\Domain\Enums\CartStatus;
use Modules\POS\Shared\Domain\Enums\DiscountType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;
use Tests\TestCase;

/**
 * PKG-POS-006: Cart repository persistence tests.
 *
 * Requires a running PostgreSQL database.
 * Run when database is available:
 *   php artisan test tests/Feature/POS/Cart/CartPersistenceTest.php
 */
final class CartPersistenceTest extends TestCase
{
    use RefreshDatabase;

    private CartRepositoryInterface $repository;

    private const SESSION_ID = 'a1000000-0000-4000-a000-000000000001';

    private const SHIFT_ID = 'b1000000-0000-4000-b000-000000000001';

    private const TERMINAL_ID = 'c1000000-0000-4000-c000-000000000001';

    private const CASHIER_ID = 'd1000000-0000-4000-d000-000000000001';

    private const CURRENCY = 'EGP';

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = app(CartRepositoryInterface::class);
    }

    private function makeCart(?string $customerId = null): Cart
    {
        return Cart::open(
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            currency: self::CURRENCY,
            customerId: $customerId,
        );
    }

    private function addWidget(Cart $cart, string $qty = '1', string $price = '10.00'): string
    {
        return $cart->addLine(
            'prod-1', 'Widget', 'WGT-001',
            Quantity::of($qty), Money::of($price, self::CURRENCY),
        );
    }

    // ── Basic CRUD ────────────────────────────────────────────────────────────

    public function test_save_and_find_by_id(): void
    {
        $cart = $this->makeCart();
        $this->repository->save($cart);

        $found = $this->repository->findById($cart->id);

        $this->assertNotNull($found);
        $this->assertSame($cart->id, $found->id);
        $this->assertSame(CartStatus::Active, $found->status);
        $this->assertSame(self::CURRENCY, $found->currency);
    }

    public function test_find_by_id_returns_null_for_unknown(): void
    {
        $found = $this->repository->findById('00000000-0000-0000-0000-000000000000');

        $this->assertNull($found);
    }

    // ── JSONB round-trips ─────────────────────────────────────────────────────

    public function test_empty_lines_round_trip(): void
    {
        $cart = $this->makeCart();
        $this->repository->save($cart);

        $found = $this->repository->findById($cart->id);

        $this->assertNotNull($found);
        $this->assertFalse($found->hasLines());
    }

    public function test_lines_round_trip_through_database(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart, '3', '25.00');
        $this->repository->save($cart);

        $found = $this->repository->findById($cart->id);

        $this->assertNotNull($found);
        $this->assertSame(1, $found->getLineCount());
        $line = $found->getLines()[0];
        $this->assertSame('3.0000', $line->quantity->value);
        $this->assertSame('25.00', $line->unitPrice->amount);
        $this->assertSame('75.00', $line->lineTotal->amount);
    }

    public function test_totals_round_trip_through_database(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart, '2', '50.00'); // 100.00
        $cart->applyOrderDiscount(DiscountType::Percentage, '10'); // -10.00 → 90.00
        $this->repository->save($cart);

        $found = $this->repository->findById($cart->id);

        $this->assertNotNull($found);
        $this->assertSame('100.00', $found->getSubtotal()->amount);
        $this->assertSame('10.00', $found->getDiscountTotal()->amount);
        $this->assertSame('90.00', $found->getTotal()->amount);
    }

    // ── findActiveBySession ───────────────────────────────────────────────────

    public function test_find_active_by_session_returns_active_cart(): void
    {
        $cart = $this->makeCart();
        $this->repository->save($cart);

        $found = $this->repository->findActiveBySession(self::SESSION_ID);

        $this->assertNotNull($found);
        $this->assertSame($cart->id, $found->id);
    }

    public function test_find_active_by_session_returns_null_when_held(): void
    {
        $cart = $this->makeCart();
        $cart->hold();
        $this->repository->save($cart);

        $found = $this->repository->findActiveBySession(self::SESSION_ID);

        $this->assertNull($found);
    }

    public function test_find_active_by_session_returns_null_for_unknown_session(): void
    {
        $found = $this->repository->findActiveBySession('z0000000-0000-0000-0000-000000000099');

        $this->assertNull($found);
    }

    // ── findHeldBySession ─────────────────────────────────────────────────────

    public function test_find_held_by_session_returns_held_carts(): void
    {
        $cart1 = $this->makeCart();
        $cart1->hold();
        $this->repository->save($cart1);

        $cart2 = $this->makeCart();
        $cart2->hold();
        $this->repository->save($cart2);

        $held = $this->repository->findHeldBySession(self::SESSION_ID);

        $this->assertCount(2, $held);
    }

    public function test_find_held_by_session_excludes_active_carts(): void
    {
        $this->repository->save($this->makeCart()); // active

        $held = $this->repository->findHeldBySession(self::SESSION_ID);

        $this->assertEmpty($held);
    }

    // ── receipt_number unique constraint ──────────────────────────────────────

    public function test_completed_cart_stores_receipt_number(): void
    {
        $cart = $this->makeCart();
        $this->addWidget($cart);
        $cart->initiatePayment();
        $cart->complete(ReceiptNumber::of('RCP-2026-000001'));
        $this->repository->save($cart);

        $found = $this->repository->findById($cart->id);

        $this->assertNotNull($found);
        $this->assertSame('RCP-2026-000001', $found->getReceiptNumber()?->value);
    }

    public function test_duplicate_receipt_number_is_rejected_by_database(): void
    {
        $rn = ReceiptNumber::of('RCP-2026-DUPE');

        $cart1 = $this->makeCart();
        $this->addWidget($cart1);
        $cart1->initiatePayment();
        $cart1->complete($rn);
        $this->repository->save($cart1);

        $cart2 = Cart::open('s2', self::SHIFT_ID, self::TERMINAL_ID, self::CASHIER_ID, self::CURRENCY);
        $this->addWidget($cart2);
        $cart2->initiatePayment();
        $cart2->complete($rn);

        $this->expectException(\Illuminate\Database\QueryException::class);

        $this->repository->save($cart2);
    }
}
