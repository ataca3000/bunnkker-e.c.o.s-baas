<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Shift;

use InvalidArgumentException;
use Modules\POS\Shared\Domain\Enums\ShiftStatus;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;
use Modules\POS\Shift\Domain\Exceptions\InvalidShiftTransitionException;
use Modules\POS\Shift\Domain\Models\Shift;
use Modules\POS\Shift\Domain\ValueObjects\ShiftNumber;
use Tests\TestCase;

/**
 * PKG-POS-005: Shift aggregate invariant tests.
 *
 * Tests all domain invariants and the cash reconciliation state machine
 * purely in-memory — no database is touched.
 *
 * State machine under test:
 *
 *   Open ──submitForClosure()──▶ Closing ──approve()──▶ Closed  (terminal)
 *                                  │  ▲
 *                                  └──┘  rejectCount() → stays Closing,
 *                                         clears count; cashier resubmits
 *                                         via submitForClosure() again
 *
 * ADR-POS-006: Rejection does NOT introduce a separate terminal Rejected state.
 */
final class ShiftAggregateTest extends TestCase
{
    // No RefreshDatabase — all tests are purely in-memory.

    private const SESSION_ID = 'session-uuid-1';

    private const TERMINAL_ID = 'terminal-uuid-1';

    private const CASHIER_ID = 'cashier-uuid-1';

    private function makeShift(
        string $sessionId = self::SESSION_ID,
        string $terminalId = self::TERMINAL_ID,
        string $cashierId = self::CASHIER_ID,
        string $amount = '1000.00',
        string $currency = 'EGP',
        int $number = 1,
    ): Shift {
        return Shift::open(
            sessionId: $sessionId,
            terminalId: $terminalId,
            cashierId: $cashierId,
            openingCash: Money::of($amount, $currency),
            shiftNumber: ShiftNumber::of($number),
        );
    }

    // ── open() ────────────────────────────────────────────────────────────────

    public function test_open_creates_shift_in_open_status(): void
    {
        $shift = $this->makeShift();

        $this->assertSame(ShiftStatus::Open, $shift->status);
        $this->assertTrue($shift->isOpen());
        $this->assertFalse($shift->isInClosing());
        $this->assertFalse($shift->isClosed());
    }

    public function test_open_stores_all_identifiers(): void
    {
        $shift = $this->makeShift();

        $this->assertSame(self::SESSION_ID, $shift->session_id);
        $this->assertSame(self::TERMINAL_ID, $shift->terminal_id);
        $this->assertSame(self::CASHIER_ID, $shift->cashier_id);
        $this->assertSame(1, $shift->shift_number);
    }

    public function test_open_stores_opening_cash(): void
    {
        $shift = $this->makeShift(amount: '500.00', currency: 'USD');
        $cash = $shift->getOpeningCash();

        $this->assertSame('500.00', $cash->amount);
        $this->assertSame('USD', $cash->currency);
    }

    public function test_open_records_opened_at(): void
    {
        $shift = $this->makeShift();

        $this->assertNotNull($shift->opened_at);
    }

    public function test_open_has_no_closing_count_initially(): void
    {
        $shift = $this->makeShift();

        $this->assertNull($shift->getClosingCount());
        $this->assertFalse($shift->hasPendingCount());
    }

    public function test_open_throws_for_empty_session_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Session ID cannot be empty');

        Shift::open('', self::TERMINAL_ID, self::CASHIER_ID, Money::of(100, 'EGP'), ShiftNumber::of(1));
    }

    public function test_open_throws_for_empty_terminal_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Terminal ID cannot be empty');

        Shift::open(self::SESSION_ID, '', self::CASHIER_ID, Money::of(100, 'EGP'), ShiftNumber::of(1));
    }

    public function test_open_throws_for_empty_cashier_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Cashier ID cannot be empty');

        Shift::open(self::SESSION_ID, self::TERMINAL_ID, '', Money::of(100, 'EGP'), ShiftNumber::of(1));
    }

    public function test_can_process_sales_when_open(): void
    {
        $shift = $this->makeShift();

        $this->assertTrue($shift->canProcessSales());
    }

    // ── submitForClosure() ────────────────────────────────────────────────────

    public function test_submit_for_closure_transitions_open_to_closing(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1050.00', 'EGP'));

        $this->assertSame(ShiftStatus::Closing, $shift->status);
        $this->assertTrue($shift->isInClosing());
    }

    public function test_submit_for_closure_stores_count_and_sets_submitted_at(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1050.00', 'EGP'));

        $count = $shift->getClosingCount();
        $this->assertNotNull($count);
        $this->assertSame('1050.00', $count->amount);
        $this->assertNotNull($shift->submitted_at);
    }

    public function test_submit_for_closure_marks_as_pending_count(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1000.00', 'EGP'));

        $this->assertTrue($shift->hasPendingCount());
    }

    public function test_submit_for_closure_clears_rejection_reason(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('980.00', 'EGP'));
        $shift->rejectCount('Too low');
        $shift->submitForClosure(Money::of('1000.00', 'EGP'));

        $this->assertNull($shift->rejection_reason);
    }

    public function test_resubmission_from_closing_is_allowed_per_adr_006(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('980.00', 'EGP'));
        $shift->rejectCount();
        $shift->submitForClosure(Money::of('1000.00', 'EGP'));

        $this->assertSame(ShiftStatus::Closing, $shift->status);
        $this->assertSame('1000.00', $shift->getClosingCount()?->amount);
    }

    public function test_submit_for_closure_throws_from_closed(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1000.00', 'EGP'));
        $shift->approve(Money::of('1000.00', 'EGP'));

        $this->expectException(InvalidShiftTransitionException::class);

        $shift->submitForClosure(Money::of('1000.00', 'EGP'));
    }

    public function test_submit_for_closure_throws_on_currency_mismatch(): void
    {
        $shift = $this->makeShift(currency: 'EGP');

        $this->expectException(InvalidShiftTransitionException::class);
        $this->expectExceptionMessage('Currency mismatch');

        $shift->submitForClosure(Money::of('1000.00', 'USD'));
    }

    public function test_can_not_process_sales_when_closing(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1000.00', 'EGP'));

        $this->assertFalse($shift->canProcessSales());
    }

    // ── approve() ─────────────────────────────────────────────────────────────

    public function test_approve_transitions_closing_to_closed(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1045.00', 'EGP'));
        $shift->approve(Money::of('1050.00', 'EGP'));

        $this->assertSame(ShiftStatus::Closed, $shift->status);
        $this->assertTrue($shift->isClosed());
    }

    public function test_approve_calculates_variance_correctly(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1045.00', 'EGP'));
        $shift->approve(Money::of('1050.00', 'EGP'));

        $variance = $shift->getVariance();
        $this->assertNotNull($variance);
        $this->assertSame('-5.00', $variance->amount);
        $this->assertTrue($variance->isNegative(), 'short: cashier has less than expected');
    }

    public function test_approve_stores_expected_closing(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1045.00', 'EGP'));
        $shift->approve(Money::of('1050.00', 'EGP'));

        $expected = $shift->getExpectedClosing();
        $this->assertNotNull($expected);
        $this->assertSame('1050.00', $expected->amount);
    }

    public function test_approve_sets_closed_at(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1000.00', 'EGP'));
        $shift->approve(Money::of('1000.00', 'EGP'));

        $this->assertNotNull($shift->closed_at);
    }

    public function test_approve_zero_variance_when_counts_match(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1000.00', 'EGP'));
        $shift->approve(Money::of('1000.00', 'EGP'));

        $this->assertTrue($shift->getVariance()?->isZero());
    }

    public function test_approve_positive_variance_when_cashier_has_excess(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1010.00', 'EGP'));
        $shift->approve(Money::of('1000.00', 'EGP'));

        $variance = $shift->getVariance();
        $this->assertSame('10.00', $variance?->amount);
        $this->assertTrue($variance->isPositive(), 'over: cashier counted more than expected');
    }

    public function test_approve_throws_from_open(): void
    {
        $shift = $this->makeShift();

        $this->expectException(InvalidShiftTransitionException::class);
        $this->expectExceptionMessage('cannot transition from "open" to "closed"');

        $shift->approve(Money::of('1000.00', 'EGP'));
    }

    public function test_approve_throws_from_closed(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1000.00', 'EGP'));
        $shift->approve(Money::of('1000.00', 'EGP'));

        $this->expectException(InvalidShiftTransitionException::class);

        $shift->approve(Money::of('1000.00', 'EGP'));
    }

    public function test_approve_throws_when_no_closing_count_after_rejection(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('900.00', 'EGP'));
        $shift->rejectCount('Too low');

        $this->expectException(InvalidShiftTransitionException::class);
        $this->expectExceptionMessage('no submitted closing count');

        $shift->approve(Money::of('1000.00', 'EGP'));
    }

    public function test_approve_throws_on_currency_mismatch(): void
    {
        $shift = $this->makeShift(currency: 'EGP');
        $shift->submitForClosure(Money::of('1000.00', 'EGP'));

        $this->expectException(InvalidShiftTransitionException::class);
        $this->expectExceptionMessage('Currency mismatch');

        $shift->approve(Money::of('1000.00', 'USD'));
    }

    // ── rejectCount() ─────────────────────────────────────────────────────────

    public function test_reject_count_stays_in_closing_per_adr_006(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('900.00', 'EGP'));
        $shift->rejectCount('Recalculate petty cash');

        $this->assertSame(ShiftStatus::Closing, $shift->status, 'ADR-POS-006: stays Closing');
    }

    public function test_reject_count_clears_closing_count(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('900.00', 'EGP'));
        $shift->rejectCount();

        $this->assertNull($shift->getClosingCount());
        $this->assertFalse($shift->hasPendingCount());
    }

    public function test_reject_count_clears_submitted_at(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('900.00', 'EGP'));
        $shift->rejectCount();

        $this->assertNull($shift->submitted_at);
    }

    public function test_reject_count_records_reason(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('900.00', 'EGP'));
        $shift->rejectCount('Coins not counted');

        $this->assertSame('Coins not counted', $shift->rejection_reason);
    }

    public function test_reject_count_reason_defaults_to_empty_string(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('900.00', 'EGP'));
        $shift->rejectCount();

        $this->assertSame('', $shift->rejection_reason);
    }

    public function test_reject_count_throws_from_open(): void
    {
        $shift = $this->makeShift();

        $this->expectException(InvalidShiftTransitionException::class);
        $this->expectExceptionMessage('cannot transition from "open" to "closing"');

        $shift->rejectCount();
    }

    public function test_reject_count_throws_from_closed(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1000.00', 'EGP'));
        $shift->approve(Money::of('1000.00', 'EGP'));

        $this->expectException(InvalidShiftTransitionException::class);

        $shift->rejectCount();
    }

    public function test_reject_count_throws_when_count_already_cleared(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('900.00', 'EGP'));
        $shift->rejectCount();

        $this->expectException(InvalidShiftTransitionException::class);
        $this->expectExceptionMessage('no submitted closing count');

        $shift->rejectCount();
    }

    // ── getShiftNumber / getOpeningCash ───────────────────────────────────────

    public function test_get_shift_number_returns_vo(): void
    {
        $shift = $this->makeShift(number: 7);

        $sn = $shift->getShiftNumber();

        $this->assertInstanceOf(ShiftNumber::class, $sn);
        $this->assertSame(7, $sn->value);
    }

    public function test_get_opening_cash_returns_money_vo(): void
    {
        $shift = $this->makeShift(amount: '750.00', currency: 'USD');

        $cash = $shift->getOpeningCash();

        $this->assertInstanceOf(Money::class, $cash);
        $this->assertSame('750.00', $cash->amount);
        $this->assertSame('USD', $cash->currency);
    }

    public function test_get_variance_returns_null_before_approval(): void
    {
        $shift = $this->makeShift();
        $shift->submitForClosure(Money::of('1000.00', 'EGP'));

        $this->assertNull($shift->getVariance());
    }

    // ── isVarianceWithinTolerance ─────────────────────────────────────────────

    public function test_variance_within_tolerance_true_when_inside_limit(): void
    {
        // Opening 1000, expected 1050, actual 1045 → variance = -5 = 0.5% of 1000
        $shift = $this->makeShift(amount: '1000.00');
        $shift->submitForClosure(Money::of('1045.00', 'EGP'));
        $shift->approve(Money::of('1050.00', 'EGP'));

        // 1% tolerance = 10 EGP threshold, |variance| = 5 ≤ 10
        $this->assertTrue($shift->isVarianceWithinTolerance(Percentage::of(1)));
    }

    public function test_variance_within_tolerance_false_when_outside_limit(): void
    {
        // Opening 1000, expected 1050, actual 1045 → variance = -5
        $shift = $this->makeShift(amount: '1000.00');
        $shift->submitForClosure(Money::of('1045.00', 'EGP'));
        $shift->approve(Money::of('1050.00', 'EGP'));

        // 0.4% tolerance = 4 EGP threshold, |variance| = 5 > 4
        $this->assertFalse($shift->isVarianceWithinTolerance(Percentage::of('0.4')));
    }

    public function test_variance_within_tolerance_false_before_approval(): void
    {
        $shift = $this->makeShift();

        $this->assertFalse($shift->isVarianceWithinTolerance(Percentage::of(5)));
    }

    public function test_variance_within_tolerance_true_for_zero_variance(): void
    {
        $shift = $this->makeShift(amount: '1000.00');
        $shift->submitForClosure(Money::of('1000.00', 'EGP'));
        $shift->approve(Money::of('1000.00', 'EGP'));

        $this->assertTrue($shift->isVarianceWithinTolerance(Percentage::of(0)));
    }

    // ── Full lifecycle ────────────────────────────────────────────────────────

    public function test_full_lifecycle_open_submit_reject_resubmit_approve(): void
    {
        $shift = $this->makeShift();
        $this->assertSame(ShiftStatus::Open, $shift->status);

        $shift->submitForClosure(Money::of('900.00', 'EGP'));
        $this->assertSame(ShiftStatus::Closing, $shift->status);
        $this->assertTrue($shift->hasPendingCount());

        $shift->rejectCount('Petty cash not included');
        $this->assertSame(ShiftStatus::Closing, $shift->status, 'ADR-POS-006');
        $this->assertFalse($shift->hasPendingCount());

        $shift->submitForClosure(Money::of('1000.00', 'EGP'));
        $this->assertSame(ShiftStatus::Closing, $shift->status);
        $this->assertTrue($shift->hasPendingCount());

        $shift->approve(Money::of('1000.00', 'EGP'));
        $this->assertSame(ShiftStatus::Closed, $shift->status);
        $this->assertTrue($shift->getVariance()?->isZero());
    }
}
