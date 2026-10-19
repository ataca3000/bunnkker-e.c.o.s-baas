<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Discount;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\POS\Discount\Domain\Enums\DiscountScope;
use Modules\POS\Discount\Domain\Enums\DiscountStatus;
use Modules\POS\Discount\Domain\Exceptions\DiscountNotFoundException;
use Modules\POS\Discount\Domain\Models\Discount;
use Modules\POS\Discount\Domain\Policies\ManualDiscountPolicy;
use Modules\POS\Discount\Domain\Policies\SupervisorApprovalPolicy;
use Modules\POS\Discount\Domain\ValueObjects\DiscountLimit;
use Modules\POS\Discount\Domain\ValueObjects\DiscountValue;
use Modules\POS\Discount\Infrastructure\Repositories\EloquentDiscountRepository;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;
use Tests\TestCase;

final class DiscountPersistenceTest extends TestCase
{
    use RefreshDatabase;

    private EloquentDiscountRepository $repo;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repo = new EloquentDiscountRepository;
    }

    // ── save / findById ───────────────────────────────────────────────────────

    public function test_save_and_find_by_id(): void
    {
        $discount = $this->makeAutoApprovedPercentage('10');
        $this->repo->save($discount);

        $found = $this->repo->findById($discount->id);
        $this->assertSame((string) $discount->id, (string) $found->id);
        $this->assertSame('cashier-001', $found->cashier_id);
        $this->assertSame(DiscountStatus::Approved->value, $found->status);
    }

    public function test_find_by_id_throws_when_not_found(): void
    {
        $this->expectException(DiscountNotFoundException::class);
        $this->repo->findById('non-existent-uuid');
    }

    // ── JSONB round-trips ─────────────────────────────────────────────────────

    public function test_percentage_discount_value_persists_as_jsonb(): void
    {
        $discount = $this->makeAutoApprovedPercentage('15');
        $this->repo->save($discount);

        $found = $this->repo->findById($discount->id);
        $value = $found->getDiscountValue();

        $this->assertTrue($value->isPercentage());
        $this->assertSame('15.0000', $value->rawValue);
        $this->assertNull($value->currency);
    }

    public function test_fixed_discount_value_persists_as_jsonb(): void
    {
        $discount = $this->makeAutoApprovedFixed('75.00');
        $this->repo->save($discount);

        $found = $this->repo->findById($discount->id);
        $value = $found->getDiscountValue();

        $this->assertTrue($value->isFixed());
        $this->assertSame('75.00', $value->rawValue);
        $this->assertSame('EGP', $value->currency);
    }

    // ── Status persistence ────────────────────────────────────────────────────

    public function test_pending_status_persists(): void
    {
        $discount = $this->makePendingPercentage('20');
        $this->repo->save($discount);

        $found = $this->repo->findById($discount->id);
        $this->assertSame(DiscountStatus::Pending->value, $found->status);
        $this->assertTrue($found->isPending());
    }

    public function test_approved_status_persists_after_supervisor_approval(): void
    {
        $discount = $this->makePendingPercentage('20');
        $discount->approve('mgr-001', new SupervisorApprovalPolicy);
        $this->repo->save($discount);

        $found = $this->repo->findById($discount->id);
        $this->assertSame(DiscountStatus::Approved->value, $found->status);
        $this->assertSame('mgr-001', $found->supervisor_id);
        $this->assertNotNull($found->approved_at);
    }

    public function test_rejected_status_persists(): void
    {
        $discount = $this->makePendingPercentage('20');
        $discount->reject('mgr-001', 'Too generous', new SupervisorApprovalPolicy);
        $this->repo->save($discount);

        $found = $this->repo->findById($discount->id);
        $this->assertSame(DiscountStatus::Rejected->value, $found->status);
        $this->assertSame('Too generous', $found->rejection_reason);
        $this->assertNotNull($found->rejected_at);
    }

    // ── Flags persist ─────────────────────────────────────────────────────────

    public function test_requires_approval_flag_persists(): void
    {
        $pending = $this->makePendingPercentage('20');
        $this->repo->save($pending);

        $found = $this->repo->findById($pending->id);
        $this->assertTrue((bool) $found->requires_approval);
    }

    public function test_auto_approved_flag_persists(): void
    {
        $discount = $this->makeAutoApprovedPercentage('5');
        $this->repo->save($discount);

        $found = $this->repo->findById($discount->id);
        $this->assertTrue((bool) $found->auto_approved);
    }

    // ── computeAmount() after persistence ─────────────────────────────────────

    public function test_compute_amount_works_after_persistence(): void
    {
        $discount = $this->makeAutoApprovedPercentage('10');
        $this->repo->save($discount);

        $found = $this->repo->findById($discount->id);
        $result = $found->computeAmount(Money::of('300.00', 'EGP'));

        $this->assertSame('30.00', $result->amount);
    }

    // ── Scope and notes persist ───────────────────────────────────────────────

    public function test_scope_and_notes_persist(): void
    {
        $discount = Discount::request(
            cashierId: 'cashier-001',
            scope: DiscountScope::CartTotal,
            value: DiscountValue::percentage(Percentage::of('5')),
            policy: ManualDiscountPolicy::withLimits(
                DiscountLimit::percentageOnly(Percentage::of('10')),
                DiscountLimit::percentageOnly(Percentage::of('30')),
            ),
            notes: 'VIP customer',
        );
        $this->repo->save($discount);

        $found = $this->repo->findById($discount->id);
        $this->assertSame(DiscountScope::CartTotal, $found->getScope());
        $this->assertSame('VIP customer', $found->notes);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeAutoApprovedPercentage(string $pct): Discount
    {
        return Discount::request(
            cashierId: 'cashier-001',
            scope: DiscountScope::LineItem,
            value: DiscountValue::percentage(Percentage::of($pct)),
            policy: ManualDiscountPolicy::withLimits(
                DiscountLimit::percentageOnly(Percentage::of('20')),
                DiscountLimit::percentageOnly(Percentage::of('30')),
            ),
        );
    }

    private function makeAutoApprovedFixed(string $amount): Discount
    {
        return Discount::request(
            cashierId: 'cashier-001',
            scope: DiscountScope::LineItem,
            value: DiscountValue::fixed(Money::of($amount, 'EGP')),
            policy: ManualDiscountPolicy::withLimits(
                DiscountLimit::fixedOnly(Money::of('100.00', 'EGP')),
                DiscountLimit::fixedOnly(Money::of('200.00', 'EGP')),
            ),
        );
    }

    private function makePendingPercentage(string $pct): Discount
    {
        return Discount::request(
            cashierId: 'cashier-001',
            scope: DiscountScope::LineItem,
            value: DiscountValue::percentage(Percentage::of($pct)),
            policy: ManualDiscountPolicy::withLimits(
                DiscountLimit::percentageOnly(Percentage::of('10')),
                DiscountLimit::percentageOnly(Percentage::of('30')),
            ),
        );
    }
}
