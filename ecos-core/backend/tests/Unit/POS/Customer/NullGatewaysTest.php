<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Customer;

use Modules\POS\Customer\Domain\Exceptions\InsufficientLoyaltyPointsException;
use Modules\POS\Customer\Domain\Exceptions\InsufficientStoreCreditException;
use Modules\POS\Customer\Infrastructure\Gateways\NullLoyaltyGateway;
use Modules\POS\Customer\Infrastructure\Gateways\NullStoreCreditGateway;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

final class NullGatewaysTest extends TestCase
{
    // ── NullLoyaltyGateway ────────────────────────────────────────────────────

    public function test_loyalty_get_balance_returns_zero(): void
    {
        $gateway = new NullLoyaltyGateway;
        $balance = $gateway->getBalance('cust-1', 'EGP');

        $this->assertSame(0, $balance->points);
        $this->assertSame('0.00', $balance->monetaryValue->amount);
        $this->assertSame('EGP', $balance->monetaryValue->currency);
    }

    public function test_loyalty_earn_points_returns_zero(): void
    {
        $gateway = new NullLoyaltyGateway;
        $earned = $gateway->earnPoints('cust-1', Money::of('100.00', 'EGP'), 'TXN-001');

        $this->assertSame(0, $earned);
    }

    public function test_loyalty_redeem_zero_points_returns_zero_money(): void
    {
        $gateway = new NullLoyaltyGateway;
        $money = $gateway->redeemPoints('cust-1', 0, 'EGP', 'TXN-001');

        $this->assertSame('0.00', $money->amount);
        $this->assertSame('EGP', $money->currency);
    }

    public function test_loyalty_redeem_positive_points_throws(): void
    {
        $gateway = new NullLoyaltyGateway;

        $this->expectException(InsufficientLoyaltyPointsException::class);
        $this->expectExceptionMessage('requested 10 loyalty points');

        $gateway->redeemPoints('cust-1', 10, 'EGP', 'TXN-001');
    }

    // ── NullStoreCreditGateway ────────────────────────────────────────────────

    public function test_store_credit_get_balance_returns_zero(): void
    {
        $gateway = new NullStoreCreditGateway;
        $balance = $gateway->getBalance('cust-1', 'EGP');

        $this->assertSame('0.00', $balance->available->amount);
        $this->assertSame('0.00', $balance->reserved->amount);
        $this->assertSame('EGP', $balance->available->currency);
    }

    public function test_store_credit_apply_zero_does_not_throw(): void
    {
        $gateway = new NullStoreCreditGateway;
        $gateway->applyCredit('cust-1', Money::zero('EGP'), 'TXN-001');

        $this->assertTrue(true);
    }

    public function test_store_credit_apply_positive_throws(): void
    {
        $gateway = new NullStoreCreditGateway;

        $this->expectException(InsufficientStoreCreditException::class);
        $this->expectExceptionMessage('store credit');

        $gateway->applyCredit('cust-1', Money::of('50.00', 'EGP'), 'TXN-001');
    }

    public function test_store_credit_apply_shows_customer_id_in_message(): void
    {
        $gateway = new NullStoreCreditGateway;

        try {
            $gateway->applyCredit('cust-abc', Money::of('10.00', 'EGP'), 'TXN-001');
            $this->fail('Expected exception not thrown.');
        } catch (InsufficientStoreCreditException $e) {
            $this->assertStringContainsString('cust-abc', $e->getMessage());
        }
    }
}
