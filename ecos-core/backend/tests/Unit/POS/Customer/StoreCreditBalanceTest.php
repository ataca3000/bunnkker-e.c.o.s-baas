<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Customer;

use InvalidArgumentException;
use Modules\POS\Customer\Domain\ValueObjects\StoreCreditBalance;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use PHPUnit\Framework\TestCase;

final class StoreCreditBalanceTest extends TestCase
{
    private Money $hundredEgp;

    private Money $tenEgp;

    private Money $zeroEgp;

    protected function setUp(): void
    {
        $this->hundredEgp = Money::of('100.00', 'EGP');
        $this->tenEgp = Money::of('10.00', 'EGP');
        $this->zeroEgp = Money::zero('EGP');
    }

    // ── of() guards ───────────────────────────────────────────────────────────

    public function test_rejects_empty_customer_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Customer ID cannot be empty');

        StoreCreditBalance::of('', $this->hundredEgp, $this->zeroEgp);
    }

    public function test_rejects_mismatched_currencies(): void
    {
        $usd = Money::of('10.00', 'USD');

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('same currency');

        StoreCreditBalance::of('cust-1', $this->hundredEgp, $usd);
    }

    // ── successful creation ───────────────────────────────────────────────────

    public function test_creates_with_available_and_reserved(): void
    {
        $balance = StoreCreditBalance::of('cust-1', $this->hundredEgp, $this->tenEgp);

        $this->assertSame('100.00', $balance->available->amount);
        $this->assertSame('10.00', $balance->reserved->amount);
    }

    // ── zero() ────────────────────────────────────────────────────────────────

    public function test_zero_creates_empty_balance(): void
    {
        $balance = StoreCreditBalance::zero('cust-1', 'EGP');

        $this->assertSame('0.00', $balance->available->amount);
        $this->assertSame('0.00', $balance->reserved->amount);
        $this->assertSame('EGP', $balance->available->currency);
    }

    public function test_zero_rejects_empty_customer_id(): void
    {
        $this->expectException(InvalidArgumentException::class);

        StoreCreditBalance::zero('', 'EGP');
    }

    // ── effectiveAvailable() ──────────────────────────────────────────────────

    public function test_effective_available_subtracts_reserved(): void
    {
        $balance = StoreCreditBalance::of('cust-1', $this->hundredEgp, $this->tenEgp);

        $this->assertSame('90.00', $balance->effectiveAvailable()->amount);
    }

    public function test_effective_available_is_zero_when_fully_reserved(): void
    {
        $balance = StoreCreditBalance::of('cust-1', $this->tenEgp, $this->tenEgp);

        $this->assertSame('0.00', $balance->effectiveAvailable()->amount);
    }

    // ── hasCredit() ───────────────────────────────────────────────────────────

    public function test_has_credit_returns_true_when_effective_available_positive(): void
    {
        $balance = StoreCreditBalance::of('cust-1', $this->hundredEgp, $this->zeroEgp);

        $this->assertTrue($balance->hasCredit());
    }

    public function test_has_credit_returns_false_when_zero_effective(): void
    {
        $balance = StoreCreditBalance::zero('cust-1', 'EGP');

        $this->assertFalse($balance->hasCredit());
    }

    // ── canApply() ────────────────────────────────────────────────────────────

    public function test_can_apply_returns_true_when_sufficient(): void
    {
        $balance = StoreCreditBalance::of('cust-1', $this->hundredEgp, $this->zeroEgp);

        $this->assertTrue($balance->canApply(Money::of('50.00', 'EGP')));
        $this->assertTrue($balance->canApply($this->hundredEgp));
    }

    public function test_can_apply_returns_false_when_insufficient(): void
    {
        $balance = StoreCreditBalance::of('cust-1', $this->tenEgp, $this->zeroEgp);

        $this->assertFalse($balance->canApply(Money::of('10.01', 'EGP')));
    }

    public function test_can_apply_returns_false_for_zero_amount(): void
    {
        $balance = StoreCreditBalance::of('cust-1', $this->hundredEgp, $this->zeroEgp);

        $this->assertFalse($balance->canApply($this->zeroEgp));
    }

    // ── toArray / fromArray ───────────────────────────────────────────────────

    public function test_to_array_has_expected_keys(): void
    {
        $balance = StoreCreditBalance::of('cust-1', $this->hundredEgp, $this->tenEgp);
        $array = $balance->toArray();

        $this->assertArrayHasKey('customer_id', $array);
        $this->assertArrayHasKey('available', $array);
        $this->assertArrayHasKey('reserved', $array);
    }

    public function test_from_array_round_trips(): void
    {
        $original = StoreCreditBalance::of('cust-abc', Money::of('250.00', 'EGP'), Money::of('25.00', 'EGP'));
        $restored = StoreCreditBalance::fromArray($original->toArray());

        $this->assertSame($original->customerId, $restored->customerId);
        $this->assertSame($original->available->amount, $restored->available->amount);
        $this->assertSame($original->reserved->amount, $restored->reserved->amount);
    }
}
