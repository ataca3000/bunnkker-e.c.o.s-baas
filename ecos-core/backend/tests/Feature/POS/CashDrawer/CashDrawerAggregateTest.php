<?php

declare(strict_types=1);

namespace Tests\Feature\POS\CashDrawer;

use InvalidArgumentException;
use Modules\POS\CashDrawer\Domain\Exceptions\InvalidDrawerOperationException;
use Modules\POS\CashDrawer\Domain\Models\CashDrawer;
use Modules\POS\Shared\Domain\Enums\CashDrawerStatus;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Tests\TestCase;

final class CashDrawerAggregateTest extends TestCase
{
    // ── open() factory ────────────────────────────────────────────────────────

    public function test_open_creates_drawer_with_open_status(): void
    {
        $drawer = $this->openDrawer();
        $this->assertSame(CashDrawerStatus::Open, $drawer->getStatus());
        $this->assertTrue($drawer->isOpen());
        $this->assertFalse($drawer->isClosed());
    }

    public function test_open_stores_opening_float(): void
    {
        $float = Money::of('500.00', 'EGP');
        $drawer = $this->openDrawer(openingFloat: $float);
        $this->assertTrue($float->equals($drawer->getOpeningFloat()));
    }

    public function test_open_allows_zero_opening_float(): void
    {
        $drawer = $this->openDrawer(openingFloat: Money::zero('EGP'));
        $this->assertTrue(Money::zero('EGP')->equals($drawer->getOpeningFloat()));
    }

    public function test_open_starts_with_empty_movements(): void
    {
        $drawer = $this->openDrawer();
        $this->assertSame(0, $drawer->getMovementCount());
        $this->assertSame([], $drawer->getMovements());
    }

    public function test_open_starts_with_no_closing_count(): void
    {
        $drawer = $this->openDrawer();
        $this->assertNull($drawer->closing_count);
    }

    public function test_open_throws_on_empty_terminal_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->openDrawer(terminalId: '');
    }

    public function test_open_throws_on_empty_session_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->openDrawer(sessionId: '');
    }

    public function test_open_throws_on_empty_shift_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->openDrawer(shiftId: '');
    }

    public function test_open_throws_on_empty_cashier_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->openDrawer(cashierId: '');
    }

    public function test_open_throws_on_empty_currency(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->openDrawer(currency: '');
    }

    public function test_open_throws_on_negative_opening_float(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->openDrawer(openingFloat: Money::of('-1.00', 'EGP'));
    }

    // ── recordCashIn() ────────────────────────────────────────────────────────

    public function test_record_cash_in_returns_movement_id(): void
    {
        $drawer = $this->openDrawer();
        $id = $drawer->recordCashIn(Money::of('100.00', 'EGP'));
        $this->assertNotEmpty($id);
    }

    public function test_record_cash_in_adds_to_movements(): void
    {
        $drawer = $this->openDrawer();
        $drawer->recordCashIn(Money::of('100.00', 'EGP'));
        $this->assertSame(1, $drawer->getMovementCount());
    }

    public function test_record_multiple_cash_ins(): void
    {
        $drawer = $this->openDrawer();
        $drawer->recordCashIn(Money::of('50.00', 'EGP'));
        $drawer->recordCashIn(Money::of('75.00', 'EGP'));
        $this->assertSame(2, $drawer->getMovementCount());
    }

    public function test_record_cash_in_throws_on_closed_drawer(): void
    {
        $drawer = $this->openAndCloseDrawer();
        $this->expectException(InvalidDrawerOperationException::class);
        $drawer->recordCashIn(Money::of('50.00', 'EGP'));
    }

    public function test_record_cash_in_throws_on_currency_mismatch(): void
    {
        $drawer = $this->openDrawer(currency: 'EGP');
        $this->expectException(InvalidArgumentException::class);
        $drawer->recordCashIn(Money::of('50.00', 'USD'));
    }

    // ── recordCashOut() ───────────────────────────────────────────────────────

    public function test_record_cash_out_returns_movement_id(): void
    {
        $drawer = $this->openDrawer();
        $id = $drawer->recordCashOut(Money::of('30.00', 'EGP'));
        $this->assertNotEmpty($id);
    }

    public function test_record_cash_out_adds_to_movements(): void
    {
        $drawer = $this->openDrawer();
        $drawer->recordCashOut(Money::of('30.00', 'EGP'));
        $this->assertSame(1, $drawer->getMovementCount());
    }

    public function test_record_cash_out_throws_on_closed_drawer(): void
    {
        $drawer = $this->openAndCloseDrawer();
        $this->expectException(InvalidDrawerOperationException::class);
        $drawer->recordCashOut(Money::of('30.00', 'EGP'));
    }

    // ── getExpectedBalance() ──────────────────────────────────────────────────

    public function test_expected_balance_equals_opening_float_with_no_movements(): void
    {
        $drawer = $this->openDrawer(openingFloat: Money::of('500.00', 'EGP'));
        $this->assertTrue(Money::of('500.00', 'EGP')->equals($drawer->getExpectedBalance()));
    }

    public function test_expected_balance_adds_cash_in(): void
    {
        $drawer = $this->openDrawer(openingFloat: Money::of('500.00', 'EGP'));
        $drawer->recordCashIn(Money::of('100.00', 'EGP'));
        $this->assertTrue(Money::of('600.00', 'EGP')->equals($drawer->getExpectedBalance()));
    }

    public function test_expected_balance_subtracts_cash_out(): void
    {
        $drawer = $this->openDrawer(openingFloat: Money::of('500.00', 'EGP'));
        $drawer->recordCashOut(Money::of('50.00', 'EGP'));
        $this->assertTrue(Money::of('450.00', 'EGP')->equals($drawer->getExpectedBalance()));
    }

    public function test_expected_balance_with_mixed_movements(): void
    {
        $drawer = $this->openDrawer(openingFloat: Money::of('500.00', 'EGP'));
        $drawer->recordCashIn(Money::of('200.00', 'EGP'));
        $drawer->recordCashOut(Money::of('75.00', 'EGP'));
        $drawer->recordCashIn(Money::of('50.00', 'EGP'));
        // 500 + 200 - 75 + 50 = 675
        $this->assertTrue(Money::of('675.00', 'EGP')->equals($drawer->getExpectedBalance()));
    }

    // ── recordClosingCount() ──────────────────────────────────────────────────

    public function test_record_closing_count_stores_actual_count(): void
    {
        $drawer = $this->openDrawer();
        $drawer->recordClosingCount(Money::of('520.00', 'EGP'));
        $this->assertNotNull($drawer->closing_count);
    }

    public function test_record_closing_count_throws_on_closed_drawer(): void
    {
        $drawer = $this->openAndCloseDrawer();
        $this->expectException(InvalidDrawerOperationException::class);
        $drawer->recordClosingCount(Money::of('500.00', 'EGP'));
    }

    public function test_record_closing_count_throws_if_already_recorded(): void
    {
        $drawer = $this->openDrawer();
        $drawer->recordClosingCount(Money::of('500.00', 'EGP'));
        $this->expectException(InvalidDrawerOperationException::class);
        $drawer->recordClosingCount(Money::of('510.00', 'EGP'));
    }

    public function test_record_closing_count_throws_on_negative_amount(): void
    {
        $drawer = $this->openDrawer();
        $this->expectException(InvalidArgumentException::class);
        $drawer->recordClosingCount(Money::of('-10.00', 'EGP'));
    }

    public function test_record_closing_count_allows_zero(): void
    {
        $drawer = $this->openDrawer();
        $drawer->recordClosingCount(Money::zero('EGP'));
        $this->assertNotNull($drawer->closing_count);
    }

    // ── getVariance() / overage / short / balanced ────────────────────────────

    public function test_variance_is_zero_when_balanced(): void
    {
        $drawer = $this->openDrawer(openingFloat: Money::of('500.00', 'EGP'));
        $drawer->recordClosingCount(Money::of('500.00', 'EGP'));
        $this->assertTrue($drawer->getVariance()->isZero());
        $this->assertTrue($drawer->isBalanced());
        $this->assertFalse($drawer->isOverage());
        $this->assertFalse($drawer->isShort());
    }

    public function test_overage_when_closing_count_exceeds_expected(): void
    {
        $drawer = $this->openDrawer(openingFloat: Money::of('500.00', 'EGP'));
        $drawer->recordClosingCount(Money::of('550.00', 'EGP'));
        $this->assertTrue($drawer->isOverage());
        $this->assertTrue(Money::of('50.00', 'EGP')->equals($drawer->getVariance()));
    }

    public function test_short_when_closing_count_below_expected(): void
    {
        $drawer = $this->openDrawer(openingFloat: Money::of('500.00', 'EGP'));
        $drawer->recordClosingCount(Money::of('480.00', 'EGP'));
        $this->assertTrue($drawer->isShort());
        $this->assertTrue(Money::of('-20.00', 'EGP')->equals($drawer->getVariance()));
    }

    public function test_variance_is_zero_when_no_closing_count(): void
    {
        $drawer = $this->openDrawer();
        $this->assertTrue($drawer->getVariance()->isZero());
        $this->assertFalse($drawer->isOverage());
        $this->assertFalse($drawer->isShort());
        $this->assertFalse($drawer->isBalanced());
    }

    // ── close() ───────────────────────────────────────────────────────────────

    public function test_close_transitions_status_to_closed(): void
    {
        $drawer = $this->openAndCloseDrawer();
        $this->assertSame(CashDrawerStatus::Closed, $drawer->getStatus());
        $this->assertTrue($drawer->isClosed());
        $this->assertFalse($drawer->isOpen());
    }

    public function test_close_throws_without_closing_count(): void
    {
        $drawer = $this->openDrawer();
        $this->expectException(InvalidDrawerOperationException::class);
        $drawer->close();
    }

    public function test_close_throws_if_already_closed(): void
    {
        $drawer = $this->openAndCloseDrawer();
        $this->expectException(InvalidDrawerOperationException::class);
        $drawer->close();
    }

    // ── Domain events ─────────────────────────────────────────────────────────

    public function test_open_fires_drawer_opened_event(): void
    {
        $drawer = $this->openDrawer();
        $events = $drawer->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(\Modules\POS\CashDrawer\Domain\Events\DrawerOpened::class, $events[0]);
    }

    public function test_record_cash_in_fires_cash_in_recorded_event(): void
    {
        $drawer = $this->openDrawer();
        $drawer->pullDomainEvents(); // clear open event
        $drawer->recordCashIn(Money::of('50.00', 'EGP'));
        $events = $drawer->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(\Modules\POS\CashDrawer\Domain\Events\CashInRecorded::class, $events[0]);
    }

    public function test_record_cash_out_fires_cash_out_recorded_event(): void
    {
        $drawer = $this->openDrawer();
        $drawer->pullDomainEvents();
        $drawer->recordCashOut(Money::of('30.00', 'EGP'));
        $events = $drawer->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(\Modules\POS\CashDrawer\Domain\Events\CashOutRecorded::class, $events[0]);
    }

    public function test_record_closing_count_fires_closing_count_recorded_event(): void
    {
        $drawer = $this->openDrawer();
        $drawer->pullDomainEvents();
        $drawer->recordClosingCount(Money::of('500.00', 'EGP'));
        $events = $drawer->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(\Modules\POS\CashDrawer\Domain\Events\ClosingCountRecorded::class, $events[0]);
    }

    public function test_close_fires_drawer_closed_event(): void
    {
        $drawer = $this->openDrawer();
        $drawer->pullDomainEvents();
        $drawer->recordClosingCount(Money::of('500.00', 'EGP'));
        $drawer->pullDomainEvents();
        $drawer->close();
        $events = $drawer->pullDomainEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(\Modules\POS\CashDrawer\Domain\Events\DrawerClosed::class, $events[0]);
    }

    public function test_pull_domain_events_clears_queue(): void
    {
        $drawer = $this->openDrawer();
        $first = $drawer->pullDomainEvents();
        $second = $drawer->pullDomainEvents();
        $this->assertNotEmpty($first);
        $this->assertEmpty($second);
    }

    // ── Full lifecycle ────────────────────────────────────────────────────────

    public function test_full_lifecycle_open_transactions_close(): void
    {
        $drawer = $this->openDrawer(openingFloat: Money::of('1000.00', 'EGP'));
        $drawer->pullDomainEvents();

        $drawer->recordCashIn(Money::of('300.00', 'EGP'));
        $drawer->recordCashOut(Money::of('50.00', 'EGP'));
        $drawer->recordCashIn(Money::of('200.00', 'EGP'));
        // Expected: 1000 + 300 - 50 + 200 = 1450
        $this->assertTrue(Money::of('1450.00', 'EGP')->equals($drawer->getExpectedBalance()));

        $drawer->recordClosingCount(Money::of('1450.00', 'EGP'));
        $this->assertTrue($drawer->isBalanced());

        $drawer->close();
        $this->assertTrue($drawer->isClosed());
        $this->assertSame(3, $drawer->getMovementCount());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function openDrawer(
        string $terminalId = 'terminal-uuid-001',
        string $sessionId = 'session-uuid-001',
        string $shiftId = 'shift-uuid-001',
        string $cashierId = 'cashier-uuid-001',
        string $currency = 'EGP',
        ?Money $openingFloat = null,
    ): CashDrawer {
        return CashDrawer::open(
            terminalId: $terminalId,
            sessionId: $sessionId,
            shiftId: $shiftId,
            cashierId: $cashierId,
            currency: $currency,
            openingFloat: $openingFloat ?? Money::of('500.00', 'EGP'),
        );
    }

    private function openAndCloseDrawer(): CashDrawer
    {
        $drawer = $this->openDrawer();
        $drawer->recordClosingCount(Money::of('500.00', 'EGP'));
        $drawer->close();

        return $drawer;
    }
}
