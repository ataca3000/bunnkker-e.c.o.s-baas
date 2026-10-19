<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Customer;

use InvalidArgumentException;
use Modules\POS\Customer\Domain\ValueObjects\LoyaltyBalance;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

final class LoyaltyBalanceTest extends TestCase
{
    private Money $tenEgp;

    private Money $zeroEgp;

    protected function setUp(): void
    {
        $this->tenEgp = Money::of('10.00', 'EGP');
        $this->zeroEgp = Money::zero('EGP');
    }

    // ── of() guards ───────────────────────────────────────────────────────────

    public function test_rejects_empty_customer_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Customer ID cannot be empty');

        LoyaltyBalance::of('', 100, $this->tenEgp);
    }

    public function test_rejects_negative_points(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Loyalty points cannot be negative');

        LoyaltyBalance::of('cust-1', -1, $this->tenEgp);
    }

    // ── successful creation ───────────────────────────────────────────────────

    public function test_creates_with_positive_points(): void
    {
        $balance = LoyaltyBalance::of('cust-1', 500, $this->tenEgp);

        $this->assertSame('cust-1', $balance->customerId);
        $this->assertSame(500, $balance->points);
        $this->assertSame('10.00', $balance->monetaryValue->amount);
    }

    public function test_creates_with_zero_points(): void
    {
        $balance = LoyaltyBalance::of('cust-1', 0, $this->zeroEgp);

        $this->assertSame(0, $balance->points);
    }

    // ── zero() ────────────────────────────────────────────────────────────────

    public function test_zero_creates_empty_balance(): void
    {
        $balance = LoyaltyBalance::zero('cust-1', 'EGP');

        $this->assertSame(0, $balance->points);
        $this->assertSame('0.00', $balance->monetaryValue->amount);
        $this->assertSame('EGP', $balance->monetaryValue->currency);
    }

    public function test_zero_rejects_empty_customer_id(): void
    {
        $this->expectException(InvalidArgumentException::class);

        LoyaltyBalance::zero('', 'EGP');
    }

    // ── helper methods ────────────────────────────────────────────────────────

    public function test_has_points_returns_true_when_points_positive(): void
    {
        $balance = LoyaltyBalance::of('cust-1', 10, $this->tenEgp);

        $this->assertTrue($balance->hasPoints());
    }

    public function test_has_points_returns_false_when_zero(): void
    {
        $balance = LoyaltyBalance::zero('cust-1', 'EGP');

        $this->assertFalse($balance->hasPoints());
    }

    public function test_can_redeem_returns_true_when_sufficient(): void
    {
        $balance = LoyaltyBalance::of('cust-1', 500, $this->tenEgp);

        $this->assertTrue($balance->canRedeem(500));
        $this->assertTrue($balance->canRedeem(100));
    }

    public function test_can_redeem_returns_false_when_insufficient(): void
    {
        $balance = LoyaltyBalance::of('cust-1', 100, $this->tenEgp);

        $this->assertFalse($balance->canRedeem(101));
    }

    public function test_can_redeem_returns_false_for_zero_points_requested(): void
    {
        $balance = LoyaltyBalance::of('cust-1', 500, $this->tenEgp);

        $this->assertFalse($balance->canRedeem(0));
    }

    // ── toArray / fromArray ───────────────────────────────────────────────────

    public function test_to_array_has_expected_keys(): void
    {
        $balance = LoyaltyBalance::of('cust-1', 200, $this->tenEgp);
        $array = $balance->toArray();

        $this->assertArrayHasKey('customer_id', $array);
        $this->assertArrayHasKey('points', $array);
        $this->assertArrayHasKey('monetary_value', $array);
    }

    public function test_from_array_round_trips(): void
    {
        $original = LoyaltyBalance::of('cust-xyz', 999, Money::of('9.99', 'EGP'));
        $restored = LoyaltyBalance::fromArray($original->toArray());

        $this->assertSame($original->customerId, $restored->customerId);
        $this->assertSame($original->points, $restored->points);
        $this->assertSame($original->monetaryValue->amount, $restored->monetaryValue->amount);
        $this->assertSame($original->monetaryValue->currency, $restored->monetaryValue->currency);
    }
}
