<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Discount;

use Modules\POS\Discount\Domain\Enums\DiscountScope;
use Modules\POS\Discount\Domain\Enums\DiscountStatus;
use Modules\POS\Discount\Domain\Events\DiscountApproved;
use Modules\POS\Discount\Domain\Events\DiscountRejected;
use Modules\POS\Discount\Domain\Events\DiscountRequested;
use Modules\POS\Discount\Domain\Exceptions\InvalidDiscountException;
use Modules\POS\Discount\Domain\Models\Discount;
use Modules\POS\Discount\Domain\Policies\ManualDiscountPolicy;
use Modules\POS\Discount\Domain\Policies\SupervisorApprovalPolicy;
use Modules\POS\Discount\Domain\ValueObjects\DiscountLimit;
use Modules\POS\Discount\Domain\ValueObjects\DiscountValue;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;
use Tests\TestCase;

final class DiscountAggregateTest extends TestCase
{
    // ── request() — auto-approved (within cashier limit) ─────────────────────

    public function test_request_within_cashier_limit_is_approved_immediately(): void
    {
        $discount = $this->requestPercentage('5', cashierMax: '10', supervisorMax: '30');

        $this->assertSame(DiscountStatus::Approved, $discount->getStatus());
        $this->assertTrue($discount->isApproved());
        $this->assertFalse($discount->isPending());
        $this->assertTrue($discount->wasAutoApproved());
        $this->assertTrue($discount->isEffective());
    }

    public function test_request_at_exact_cashier_limit_is_auto_approved(): void
    {
        $discount = $this->requestPercentage('10', cashierMax: '10', supervisorMax: '30');

        $this->assertTrue($discount->isApproved());
        $this->assertTrue($discount->wasAutoApproved());
    }

    public function test_auto_approved_discount_fires_requested_and_approved_events(): void
    {
        $discount = $this->requestPercentage('5', cashierMax: '10', supervisorMax: '30');
        $events = $discount->pullDomainEvents();

        $this->assertCount(2, $events);
        $this->assertInstanceOf(DiscountRequested::class, $events[0]);
        $this->assertInstanceOf(DiscountApproved::class, $events[1]);
        $this->assertTrue($events[1]->autoApproved);
        $this->assertNull($events[1]->supervisorId);
    }

    public function test_auto_approved_discount_has_no_supervisor_id(): void
    {
        $discount = $this->requestPercentage('5', cashierMax: '10', supervisorMax: '30');
        $this->assertNull($discount->supervisor_id);
    }

    // ── request() — pending approval (above cashier limit, within supervisor limit) ──

    public function test_request_above_cashier_limit_is_pending(): void
    {
        $discount = $this->requestPercentage('20', cashierMax: '10', supervisorMax: '30');

        $this->assertSame(DiscountStatus::Pending, $discount->getStatus());
        $this->assertTrue($discount->isPending());
        $this->assertFalse($discount->isApproved());
        $this->assertFalse($discount->wasAutoApproved());
    }

    public function test_pending_discount_fires_only_requested_event(): void
    {
        $discount = $this->requestPercentage('20', cashierMax: '10', supervisorMax: '30');
        $events = $discount->pullDomainEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(DiscountRequested::class, $events[0]);
        $this->assertTrue($events[0]->requiresApproval);
    }

    public function test_request_stores_scope_and_value(): void
    {
        $discount = $this->requestPercentage('15', cashierMax: '10', supervisorMax: '30');

        $this->assertSame(DiscountScope::LineItem, $discount->getScope());
        $this->assertSame('percentage', $discount->discount_type);
        $this->assertSame('15.0000', $discount->getDiscountValue()->rawValue);
    }

    public function test_request_stores_notes(): void
    {
        $discount = $this->requestPercentage(
            '5', cashierMax: '10', supervisorMax: '30', notes: 'Loyal customer',
        );
        $this->assertSame('Loyal customer', $discount->notes);
    }

    // ── request() — validation ─────────────────────────────────────────────────

    public function test_request_throws_on_empty_cashier_id(): void
    {
        $this->expectException(InvalidDiscountException::class);
        Discount::request('', DiscountScope::LineItem, $this->percentageValue('10'), $this->makePolicy());
    }

    public function test_request_throws_when_exceeds_supervisor_limit(): void
    {
        $this->expectException(InvalidDiscountException::class);
        $this->requestPercentage('50', cashierMax: '10', supervisorMax: '30');
    }

    public function test_request_passes_at_exact_supervisor_limit(): void
    {
        $discount = $this->requestPercentage('30', cashierMax: '10', supervisorMax: '30');
        $this->assertTrue($discount->isPending());
    }

    // ── approve() ─────────────────────────────────────────────────────────────

    public function test_approve_transitions_pending_to_approved(): void
    {
        $discount = $this->requestPercentage('20', cashierMax: '10', supervisorMax: '30');
        $discount->approve('mgr-001', new SupervisorApprovalPolicy);

        $this->assertSame(DiscountStatus::Approved, $discount->getStatus());
        $this->assertTrue($discount->isApproved());
        $this->assertFalse($discount->wasAutoApproved());
    }

    public function test_approve_stores_supervisor_id(): void
    {
        $discount = $this->requestPercentage('20', cashierMax: '10', supervisorMax: '30');
        $discount->approve('mgr-001', new SupervisorApprovalPolicy);
        $this->assertSame('mgr-001', $discount->supervisor_id);
    }

    public function test_approve_sets_approved_at(): void
    {
        $discount = $this->requestPercentage('20', cashierMax: '10', supervisorMax: '30');
        $discount->approve('mgr-001', new SupervisorApprovalPolicy);
        $this->assertNotNull($discount->approved_at);
    }

    public function test_approve_fires_discount_approved_event(): void
    {
        $discount = $this->requestPercentage('20', cashierMax: '10', supervisorMax: '30');
        $discount->pullDomainEvents();  // clear requested event
        $discount->approve('mgr-001', new SupervisorApprovalPolicy);
        $events = $discount->pullDomainEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(DiscountApproved::class, $events[0]);
        $this->assertFalse($events[0]->autoApproved);
        $this->assertSame('mgr-001', $events[0]->supervisorId);
    }

    public function test_approve_throws_on_already_approved_discount(): void
    {
        $discount = $this->requestPercentage('5', cashierMax: '10', supervisorMax: '30');
        $this->expectException(InvalidDiscountException::class);
        $discount->approve('mgr-001', new SupervisorApprovalPolicy);
    }

    public function test_approve_throws_on_rejected_discount(): void
    {
        $discount = $this->requestPercentage('20', cashierMax: '10', supervisorMax: '30');
        $discount->reject('mgr-001', 'too high', new SupervisorApprovalPolicy);
        $this->expectException(InvalidDiscountException::class);
        $discount->approve('mgr-001', new SupervisorApprovalPolicy);
    }

    public function test_approve_throws_on_empty_supervisor_id(): void
    {
        $discount = $this->requestPercentage('20', cashierMax: '10', supervisorMax: '30');
        $this->expectException(InvalidDiscountException::class);
        $discount->approve('', new SupervisorApprovalPolicy);
    }

    // ── reject() ──────────────────────────────────────────────────────────────

    public function test_reject_transitions_pending_to_rejected(): void
    {
        $discount = $this->requestPercentage('20', cashierMax: '10', supervisorMax: '30');
        $discount->reject('mgr-001', 'Excessive discount', new SupervisorApprovalPolicy);

        $this->assertSame(DiscountStatus::Rejected, $discount->getStatus());
        $this->assertTrue($discount->isRejected());
    }

    public function test_reject_stores_reason(): void
    {
        $discount = $this->requestPercentage('20', cashierMax: '10', supervisorMax: '30');
        $discount->reject('mgr-001', 'Too large', new SupervisorApprovalPolicy);
        $this->assertSame('Too large', $discount->rejection_reason);
    }

    public function test_reject_fires_discount_rejected_event(): void
    {
        $discount = $this->requestPercentage('20', cashierMax: '10', supervisorMax: '30');
        $discount->pullDomainEvents();
        $discount->reject('mgr-001', 'Too large', new SupervisorApprovalPolicy);
        $events = $discount->pullDomainEvents();

        $this->assertCount(1, $events);
        $this->assertInstanceOf(DiscountRejected::class, $events[0]);
        $this->assertSame('Too large', $events[0]->reason);
    }

    public function test_reject_throws_on_empty_reason(): void
    {
        $discount = $this->requestPercentage('20', cashierMax: '10', supervisorMax: '30');
        $this->expectException(InvalidDiscountException::class);
        $discount->reject('mgr-001', '', new SupervisorApprovalPolicy);
    }

    public function test_reject_throws_on_already_approved_discount(): void
    {
        $discount = $this->requestPercentage('5', cashierMax: '10', supervisorMax: '30');
        $this->expectException(InvalidDiscountException::class);
        $discount->reject('mgr-001', 'reason', new SupervisorApprovalPolicy);
    }

    // ── computeAmount() ───────────────────────────────────────────────────────

    public function test_compute_amount_percentage_uses_bcmath(): void
    {
        $discount = $this->requestPercentage('10', cashierMax: '20', supervisorMax: '30');
        $base = Money::of('200.00', 'EGP');
        $result = $discount->computeAmount($base);

        $this->assertSame('20.00', $result->amount);
        $this->assertSame('EGP', $result->currency);
    }

    public function test_compute_amount_fixed_returns_fixed(): void
    {
        $discount = $this->requestFixed('50.00', cashierMax: '100.00', supervisorMax: '200.00');
        $base = Money::of('300.00', 'EGP');
        $result = $discount->computeAmount($base);

        $this->assertSame('50.00', $result->amount);
    }

    public function test_compute_amount_throws_on_non_approved_discount(): void
    {
        $discount = $this->requestPercentage('20', cashierMax: '10', supervisorMax: '30');
        $this->expectException(InvalidDiscountException::class);
        $discount->computeAmount(Money::of('100.00', 'EGP'));
    }

    // ── domain event queue management ─────────────────────────────────────────

    public function test_pull_domain_events_clears_queue(): void
    {
        $discount = $this->requestPercentage('5', cashierMax: '10', supervisorMax: '30');
        $first = $discount->pullDomainEvents();
        $second = $discount->pullDomainEvents();
        $this->assertNotEmpty($first);
        $this->assertEmpty($second);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function requestPercentage(
        string $pct,
        string $cashierMax,
        string $supervisorMax,
        string $cashierId = 'cashier-001',
        ?string $notes = null,
    ): Discount {
        return Discount::request(
            cashierId: $cashierId,
            scope: DiscountScope::LineItem,
            value: $this->percentageValue($pct),
            policy: ManualDiscountPolicy::withLimits(
                DiscountLimit::percentageOnly(Percentage::of($cashierMax)),
                DiscountLimit::percentageOnly(Percentage::of($supervisorMax)),
            ),
            notes: $notes,
        );
    }

    private function requestFixed(
        string $amount,
        string $cashierMax,
        string $supervisorMax,
        string $cashierId = 'cashier-001',
    ): Discount {
        return Discount::request(
            cashierId: $cashierId,
            scope: DiscountScope::CartTotal,
            value: DiscountValue::fixed(Money::of($amount, 'EGP')),
            policy: ManualDiscountPolicy::withLimits(
                DiscountLimit::fixedOnly(Money::of($cashierMax, 'EGP')),
                DiscountLimit::fixedOnly(Money::of($supervisorMax, 'EGP')),
            ),
        );
    }

    private function percentageValue(string $pct): DiscountValue
    {
        return DiscountValue::percentage(Percentage::of($pct));
    }

    private function makePolicy(string $cashierMax = '10', string $supervisorMax = '30'): ManualDiscountPolicy
    {
        return ManualDiscountPolicy::withLimits(
            DiscountLimit::percentageOnly(Percentage::of($cashierMax)),
            DiscountLimit::percentageOnly(Percentage::of($supervisorMax)),
        );
    }
}
