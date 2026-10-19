<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Payment;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Payment\Domain\Contracts\PaymentRepositoryInterface;
use Modules\POS\Payment\Domain\Enums\PaymentStatus;
use Modules\POS\Payment\Domain\Models\Payment;
use Modules\POS\Shared\Domain\Enums\PaymentMethodType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Tests\TestCase;

/**
 * PKG-POS-007: Payment repository persistence tests.
 *
 * Requires a running PostgreSQL database.
 * Run when database is available:
 *   php artisan test tests/Feature/POS/Payment/PaymentPersistenceTest.php
 */
final class PaymentPersistenceTest extends TestCase
{
    use RefreshDatabase;

    private PaymentRepositoryInterface $repository;

    private const CART_ID = 'a1000000-0000-4000-a000-000000000001';

    private const SESSION_ID = 'b1000000-0000-4000-b000-000000000001';

    private const SHIFT_ID = 'c1000000-0000-4000-c000-000000000001';

    private const TERMINAL_ID = 'd1000000-0000-4000-d000-000000000001';

    private const CASHIER_ID = 'e1000000-0000-4000-e000-000000000001';

    private const CURRENCY = 'EGP';

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = app(PaymentRepositoryInterface::class);
    }

    private function makePayment(string $cartId = self::CART_ID, string $amount = '150.00'): Payment
    {
        return Payment::initiate(
            cartId: $cartId,
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            cartTotal: Money::of($amount, self::CURRENCY),
        );
    }

    // ── Basic CRUD ────────────────────────────────────────────────────────────

    public function test_save_and_find_by_id(): void
    {
        $payment = $this->makePayment();
        $this->repository->save($payment);

        $found = $this->repository->findById($payment->id);

        $this->assertNotNull($found);
        $this->assertSame($payment->id, $found->id);
        $this->assertSame(PaymentStatus::Pending, $found->status);
        $this->assertSame(self::CURRENCY, $found->currency);
    }

    public function test_find_by_id_returns_null_for_unknown(): void
    {
        $found = $this->repository->findById('00000000-0000-0000-0000-000000000000');
        $this->assertNull($found);
    }

    public function test_find_by_cart_id_returns_payment(): void
    {
        $payment = $this->makePayment();
        $this->repository->save($payment);

        $found = $this->repository->findByCartId(self::CART_ID);

        $this->assertNotNull($found);
        $this->assertSame($payment->id, $found->id);
    }

    public function test_find_by_cart_id_returns_null_for_unknown(): void
    {
        $found = $this->repository->findByCartId('00000000-0000-0000-0000-000000000000');
        $this->assertNull($found);
    }

    // ── JSONB round-trips ─────────────────────────────────────────────────────

    public function test_cart_total_round_trips(): void
    {
        $payment = $this->makePayment(amount: '199.99');
        $this->repository->save($payment);

        $found = $this->repository->findById($payment->id);

        $this->assertNotNull($found);
        $this->assertSame('199.99', $found->getCartTotal()->amount);
        $this->assertSame(self::CURRENCY, $found->getCartTotal()->currency);
    }

    public function test_empty_tenders_round_trip(): void
    {
        $payment = $this->makePayment();
        $this->repository->save($payment);

        $found = $this->repository->findById($payment->id);

        $this->assertNotNull($found);
        $this->assertFalse($found->hasTenders());
        $this->assertSame(0, $found->getTenderCount());
    }

    public function test_tenders_round_trip(): void
    {
        $payment = $this->makePayment(amount: '150.00');
        $payment->addTender(PaymentMethodType::Cash, Money::of('100.00', self::CURRENCY));
        $payment->addTender(PaymentMethodType::Card, Money::of('50.00', self::CURRENCY), 'AUTH-99');
        $this->repository->save($payment);

        $found = $this->repository->findById($payment->id);

        $this->assertNotNull($found);
        $this->assertSame(2, $found->getTenderCount());

        $tenders = $found->getTenders();
        $this->assertSame(PaymentMethodType::Cash, $tenders[0]->type);
        $this->assertSame('100.00', $tenders[0]->amount->amount);
        $this->assertSame(PaymentMethodType::Card, $tenders[1]->type);
        $this->assertSame('AUTH-99', $tenders[1]->reference);
    }

    public function test_amount_tendered_and_change_due_round_trip(): void
    {
        $payment = $this->makePayment(amount: '100.00');
        $payment->addTender(PaymentMethodType::Cash, Money::of('120.00', self::CURRENCY));
        $this->repository->save($payment);

        $found = $this->repository->findById($payment->id);

        $this->assertNotNull($found);
        $this->assertSame('120.00', $found->getAmountTendered()->amount);
        $this->assertSame('20.00', $found->getChangeDue()->amount);
    }

    // ── Unique cart_id constraint ─────────────────────────────────────────────

    public function test_duplicate_cart_id_is_rejected_by_database(): void
    {
        $payment1 = $this->makePayment();
        $this->repository->save($payment1);

        $payment2 = $this->makePayment(cartId: self::CART_ID);

        $this->expectException(\Illuminate\Database\QueryException::class);
        $this->repository->save($payment2);
    }

    // ── Status persistence ────────────────────────────────────────────────────

    public function test_captured_status_persists(): void
    {
        $payment = $this->makePayment(amount: '100.00');
        $payment->addTender(PaymentMethodType::Cash, Money::of('100.00', self::CURRENCY));
        $payment->capture();
        $this->repository->save($payment);

        $found = $this->repository->findById($payment->id);

        $this->assertNotNull($found);
        $this->assertSame(PaymentStatus::Captured, $found->status);
        $this->assertTrue($found->isCaptured());
    }

    public function test_captured_at_is_stored(): void
    {
        $payment = $this->makePayment(amount: '75.00');
        $payment->addTender(PaymentMethodType::Cash, Money::of('75.00', self::CURRENCY));
        $payment->capture();
        $this->repository->save($payment);

        $found = $this->repository->findById($payment->id);

        $this->assertNotNull($found);
        $this->assertNotNull($found->captured_at);
    }

    public function test_fully_paid_state_is_correct_after_reload(): void
    {
        $payment = $this->makePayment(amount: '50.00');
        $payment->addTender(PaymentMethodType::Cash, Money::of('50.00', self::CURRENCY));
        $this->repository->save($payment);

        $found = $this->repository->findById($payment->id);

        $this->assertNotNull($found);
        $this->assertTrue($found->isFullyPaid());
    }
}
