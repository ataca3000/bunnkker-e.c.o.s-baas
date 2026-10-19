<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Application;

use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Modules\POS\Application\Commands\SetCartCustomerCommand;
use Modules\POS\Application\Services\SetCartCustomerService;
use Modules\POS\Cart\Domain\Contracts\CartRepositoryInterface;
use Modules\POS\Cart\Domain\Models\Cart;
use Tests\TestCase;
use Throwable;

/**
 * PKG-POS-021: SetCartCustomerService integration tests.
 *
 * Requires PostgreSQL — run with:
 *   php artisan test tests/Feature/POS/Application/SetCartCustomerIntegrationTest.php
 */
final class SetCartCustomerIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private SetCartCustomerService $service;

    private CartRepositoryInterface $cartRepo;

    private const SESSION_ID = 'a3000000-0000-4000-a000-000000000001';

    private const SHIFT_ID = 'b3000000-0000-4000-b000-000000000001';

    private const TERMINAL_ID = 'c3000000-0000-4000-c000-000000000001';

    private const CASHIER_ID = 'd3000000-0000-4000-d000-000000000001';

    private const CUSTOMER_A = 'e3000000-0000-4000-e000-000000000001';

    private const CUSTOMER_B = 'f3000000-0000-4000-f000-000000000002';

    private const CURRENCY = 'EGP';

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = app(SetCartCustomerService::class);
        $this->cartRepo = app(CartRepositoryInterface::class);
    }

    public function test_attaches_customer_to_active_cart(): void
    {
        $cart = $this->makePersistedCart();

        $result = $this->service->execute(
            new SetCartCustomerCommand(cartId: (string) $cart->id, customerId: self::CUSTOMER_A),
        );

        $this->assertSame(self::CUSTOMER_A, $result->customer_id);

        $fresh = $this->cartRepo->findById((string) $cart->id);
        $this->assertSame(self::CUSTOMER_A, $fresh->customer_id);
    }

    public function test_replaces_existing_customer(): void
    {
        $cart = $this->makePersistedCart();
        $cart->customer_id = self::CUSTOMER_A;
        $this->cartRepo->save($cart);

        $result = $this->service->execute(
            new SetCartCustomerCommand(cartId: (string) $cart->id, customerId: self::CUSTOMER_B),
        );

        $this->assertSame(self::CUSTOMER_B, $result->customer_id);

        $fresh = $this->cartRepo->findById((string) $cart->id);
        $this->assertSame(self::CUSTOMER_B, $fresh->customer_id);
    }

    public function test_removes_customer_when_null_passed(): void
    {
        $cart = $this->makePersistedCart();
        $cart->customer_id = self::CUSTOMER_A;
        $this->cartRepo->save($cart);

        $result = $this->service->execute(
            new SetCartCustomerCommand(cartId: (string) $cart->id, customerId: null),
        );

        $this->assertNull($result->customer_id);

        $fresh = $this->cartRepo->findById((string) $cart->id);
        $this->assertNull($fresh->customer_id);
    }

    public function test_customer_persists_through_hold_and_resume(): void
    {
        $cart = $this->makePersistedCart();

        $this->service->execute(
            new SetCartCustomerCommand(cartId: (string) $cart->id, customerId: self::CUSTOMER_A),
        );

        $cart->hold();
        $this->cartRepo->save($cart);
        $cart->resume();
        $this->cartRepo->save($cart);

        $fresh = $this->cartRepo->findById((string) $cart->id);
        $this->assertSame(self::CUSTOMER_A, $fresh->customer_id);
    }

    public function test_throws_when_cart_not_found(): void
    {
        $this->expectException(Throwable::class);

        $this->service->execute(
            new SetCartCustomerCommand(
                cartId: 'ffffffff-ffff-4fff-ffff-ffffffffffff',
                customerId: self::CUSTOMER_A,
            ),
        );
    }

    public function test_throws_when_cart_is_in_terminal_state(): void
    {
        $cart = $this->makePersistedCart();
        $cart->cancel();
        $this->cartRepo->save($cart);

        $this->expectException(InvalidArgumentException::class);

        $this->service->execute(
            new SetCartCustomerCommand(cartId: (string) $cart->id, customerId: self::CUSTOMER_A),
        );
    }

    private function makePersistedCart(): Cart
    {
        $cart = Cart::open(
            sessionId: self::SESSION_ID,
            shiftId: self::SHIFT_ID,
            terminalId: self::TERMINAL_ID,
            cashierId: self::CASHIER_ID,
            currency: self::CURRENCY,
        );

        $this->cartRepo->save($cart);

        return $cart;
    }
}
