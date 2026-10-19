<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Discount;

use Modules\POS\Discount\Domain\Exceptions\InvalidDiscountException;
use Modules\POS\Discount\Domain\Policies\ManualDiscountPolicy;
use Modules\POS\Discount\Domain\Policies\SupervisorApprovalPolicy;
use Modules\POS\Discount\Domain\ValueObjects\DiscountLimit;
use Modules\POS\Discount\Domain\ValueObjects\DiscountValue;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;
use PHPUnit\Framework\TestCase;

final class ManualDiscountPolicyTest extends TestCase
{
    // ── validate() — rejects values exceeding supervisor limit ────────────────

    public function test_validate_passes_when_within_supervisor_limit(): void
    {
        $policy = $this->makePolicy(cashierMax: '10', supervisorMax: '30');
        $value = DiscountValue::percentage(Percentage::of('25'));
        $policy->validate($value); // no exception
        $this->assertTrue(true);
    }

    public function test_validate_throws_when_exceeds_supervisor_limit(): void
    {
        $policy = $this->makePolicy(cashierMax: '10', supervisorMax: '30');
        $value = DiscountValue::percentage(Percentage::of('50'));
        $this->expectException(InvalidDiscountException::class);
        $policy->validate($value);
    }

    public function test_validate_passes_at_exact_supervisor_limit(): void
    {
        $policy = $this->makePolicy(cashierMax: '10', supervisorMax: '30');
        $value = DiscountValue::percentage(Percentage::of('30'));
        $policy->validate($value);
        $this->assertTrue(true);
    }

    // ── requiresApproval() ────────────────────────────────────────────────────

    public function test_requires_approval_false_when_within_cashier_limit(): void
    {
        $policy = $this->makePolicy(cashierMax: '10', supervisorMax: '30');
        $value = DiscountValue::percentage(Percentage::of('5'));
        $this->assertFalse($policy->requiresApproval($value));
    }

    public function test_requires_approval_false_at_exact_cashier_limit(): void
    {
        $policy = $this->makePolicy(cashierMax: '10', supervisorMax: '30');
        $value = DiscountValue::percentage(Percentage::of('10'));
        $this->assertFalse($policy->requiresApproval($value));
    }

    public function test_requires_approval_true_when_exceeds_cashier_limit(): void
    {
        $policy = $this->makePolicy(cashierMax: '10', supervisorMax: '30');
        $value = DiscountValue::percentage(Percentage::of('15'));
        $this->assertTrue($policy->requiresApproval($value));
    }

    public function test_requires_approval_true_at_supervisor_limit(): void
    {
        $policy = $this->makePolicy(cashierMax: '10', supervisorMax: '30');
        $value = DiscountValue::percentage(Percentage::of('30'));
        $this->assertTrue($policy->requiresApproval($value));
    }

    // ── fixed-amount limits ───────────────────────────────────────────────────

    public function test_validate_fixed_within_supervisor_limit(): void
    {
        $policy = $this->makeFixedPolicy(cashierMax: '50.00', supervisorMax: '200.00');
        $value = DiscountValue::fixed(Money::of('150.00', 'EGP'));
        $policy->validate($value);
        $this->assertTrue(true);
    }

    public function test_validate_fixed_exceeds_supervisor_limit(): void
    {
        $policy = $this->makeFixedPolicy(cashierMax: '50.00', supervisorMax: '200.00');
        $value = DiscountValue::fixed(Money::of('250.00', 'EGP'));
        $this->expectException(InvalidDiscountException::class);
        $policy->validate($value);
    }

    public function test_requires_approval_for_fixed_exceeding_cashier_limit(): void
    {
        $policy = $this->makeFixedPolicy(cashierMax: '50.00', supervisorMax: '200.00');
        $value = DiscountValue::fixed(Money::of('100.00', 'EGP'));
        $this->assertTrue($policy->requiresApproval($value));
    }

    // ── SupervisorApprovalPolicy ──────────────────────────────────────────────

    public function test_supervisor_approval_policy_allows_non_empty_id(): void
    {
        $policy = new SupervisorApprovalPolicy;
        $policy->validateApprover('supervisor-uuid-001'); // no exception
        $this->assertTrue(true);
    }

    public function test_supervisor_approval_policy_rejects_empty_id(): void
    {
        $policy = new SupervisorApprovalPolicy;
        $this->expectException(InvalidDiscountException::class);
        $policy->validateApprover('');
    }

    public function test_supervisor_approval_policy_rejects_whitespace_id(): void
    {
        $policy = new SupervisorApprovalPolicy;
        $this->expectException(InvalidDiscountException::class);
        $policy->validateApprover('   ');
    }

    public function test_can_approve_returns_true_for_non_empty(): void
    {
        $policy = new SupervisorApprovalPolicy;
        $this->assertTrue($policy->canApprove('mgr-001'));
        $this->assertFalse($policy->canApprove(''));
    }

    // ── accessors ─────────────────────────────────────────────────────────────

    public function test_policy_exposes_limits(): void
    {
        $cashier = DiscountLimit::percentageOnly(Percentage::of('10'));
        $supervisor = DiscountLimit::percentageOnly(Percentage::of('30'));
        $policy = ManualDiscountPolicy::withLimits($cashier, $supervisor);

        $this->assertSame($cashier, $policy->cashierLimit());
        $this->assertSame($supervisor, $policy->supervisorLimit());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makePolicy(string $cashierMax, string $supervisorMax): ManualDiscountPolicy
    {
        return ManualDiscountPolicy::withLimits(
            DiscountLimit::percentageOnly(Percentage::of($cashierMax)),
            DiscountLimit::percentageOnly(Percentage::of($supervisorMax)),
        );
    }

    private function makeFixedPolicy(string $cashierMax, string $supervisorMax): ManualDiscountPolicy
    {
        return ManualDiscountPolicy::withLimits(
            DiscountLimit::fixedOnly(Money::of($cashierMax, 'EGP')),
            DiscountLimit::fixedOnly(Money::of($supervisorMax, 'EGP')),
        );
    }
}
